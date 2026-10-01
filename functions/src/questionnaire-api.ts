import express from 'express';
import type {Request,Response,NextFunction} from 'express';
import {createHash} from 'node:crypto';
import {sessionIsCurrent} from './session-policy.js';
import {QuestionnaireError,parsePublish,object,bounded,tokenPattern,uuidPattern,safeId} from './questionnaire-model.js';
import type {QuestionnairePort} from './questionnaire-repository.js';
interface Dependencies {
  repository:QuestionnairePort;allowedOrigins:string[];
  verifyToken:(token:string)=>Promise<{uid:string;name?:string;email?:string;auth_time?:unknown;firebase?:{sign_in_provider?:string}}>;
  now?:()=>number;
}
export function createQuestionnaireApp(deps:Dependencies){
  const app=express();app.disable('x-powered-by');app.disable('etag');
  const rate=new Map<string,{at:number;count:number}>(),now=deps.now||Date.now;
  app.use((req,res,next)=>{
    res.set({'Cache-Control':'private, no-store, max-age=0, must-revalidate','CDN-Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});
    if(req.headers.origin&&!deps.allowedOrigins.includes(req.headers.origin)){res.status(403).json({error:'FORBIDDEN'});return;}
    if(req.method==='POST'&&(!req.is('application/json')||req.headers['x-client-request']!=='weride-questionnaire-v1')){res.status(403).json({error:'FORBIDDEN'});return;}
    const key=createHash('sha256').update(req.ip||'unknown').digest('hex'),old=rate.get(key);
    const window=old&&now()-old.at<60000?old:{at:now(),count:0};window.count++;rate.set(key,window);
    if(rate.size>5000)for(const [k,v] of rate)if(now()-v.at>=60000)rate.delete(k);
    if(window.count>180){res.status(429).set('Retry-After','60').json({error:'LIMIT'});return;}next();
  });
  app.use(express.json({limit:'768kb',strict:true}));
  const authenticate=async(req:Request)=>{
    const m=/^Bearer (\S{20,8192})$/.exec(req.headers.authorization||'');if(!m)throw new QuestionnaireError('AUTH_REQUIRED',401);
    let user;try{user=await deps.verifyToken(m[1]);}catch{throw new QuestionnaireError('AUTH_REQUIRED',401);}
    if(!user.uid||!user.email||!/^[a-z0-9._%+-]+@madison[.]dev$/i.test(user.email)||user.firebase?.sign_in_provider!=='microsoft.com')throw new QuestionnaireError('FORBIDDEN',403);
    if(!sessionIsCurrent(user,now()))throw new QuestionnaireError('AUTH_REQUIRED',401);return user;
  };
  app.use(async(req,res,next)=>{
    try{
      const path=req.path,repo=deps.repository;
      if(path==='/status'&&req.method==='GET'){res.json({service:'weride-client-questionnaires',available:true});return;}
      const publicRoute=/^\/public\/([A-Za-z0-9_-]{43})\/(open|start|session|save|submit)$/.exec(path);
      if(publicRoute){
        if(req.method!=='POST'){res.status(405).set('Allow','POST').json({error:'METHOD'});return;}
        const [,token,action]=publicRoute,b=object(req.body);
        const allowed=action==='open'?['code']:action==='start'?['key','code','identity','consent']:action==='session'?['key']:['key','revision','answers','confirm'];
        if(Object.keys(b).some(k=>!allowed.includes(k)))throw new QuestionnaireError('VALIDATION');
        const fingerprint=createHash('sha256').update(req.ip||'unknown').digest('hex');
        if(action==='open'){res.json(await repo.open(token,bounded(b.code??'',64,false),fingerprint));return;}
        const key=bounded(b.key,43);if(!tokenPattern.test(key))throw new QuestionnaireError('SESSION',401);
        if(action==='start'){
          if(b.consent!==true)throw new QuestionnaireError('CONSENT');
          res.json(await repo.start(token,key,bounded(b.code??'',64,false),b.identity,fingerprint));return;
        }
        if(action==='session'){res.json(await repo.session(token,key));return;}
        if(!Number.isInteger(b.revision)||Number(b.revision)<0||Number(b.revision)>10000)throw new QuestionnaireError('VALIDATION');
        if(action==='submit'&&b.confirm!==true)throw new QuestionnaireError('CONSENT');
        res.json(await repo.save(token,key,Number(b.revision),b.answers,action==='submit'));return;
      }
      if(!path.startsWith('/mine'))throw new QuestionnaireError('NOT_FOUND',404);
      const user=await authenticate(req),name=(user.name||user.email||'Madison reviewer').slice(0,120);
      if(path==='/mine'&&req.method==='GET'){
        const cursor=req.query.cursor;if(cursor!==undefined&&(typeof cursor!=='string'||!uuidPattern.test(cursor)))throw new QuestionnaireError('VALIDATION');
        res.json(await repo.list(user.uid,cursor as string|undefined));return;
      }
      if(path==='/mine'&&req.method==='POST'){
        const b=object(req.body);
        if(Object.keys(b).some(k=>!['options','requestId','expectedSourceHash','code','acknowledge'].includes(k))||b.acknowledge!==true)throw new QuestionnaireError('CONSENT');
        if(!uuidPattern.test(String(b.requestId))||!/^[a-f0-9]{64}$/.test(String(b.expectedSourceHash)))throw new QuestionnaireError('VALIDATION');
        const code=bounded(b.code??'',64,false);if(code&&code.length<12)throw new QuestionnaireError('CODE_LENGTH');
        res.status(201).json(await repo.publish(user.uid,name,String(b.requestId),parsePublish(b.options),String(b.expectedSourceHash),code));return;
      }
      const match=/^\/mine\/([a-f0-9-]{36})(?:\/(state|submissions)(?:\/([a-f0-9-]{36})(?:\/(import))?)?)?$/.exec(path);
      if(!match||!uuidPattern.test(match[1])||match[3]&&!uuidPattern.test(match[3]))throw new QuestionnaireError('NOT_FOUND',404);
      const [,id,action,submissionId,operation]=match;
      if(!action&&req.method==='GET'){res.json(await repo.detail(user.uid,id));return;}
      if(action==='state'&&req.method==='POST'){
        const b=object(req.body);if(Object.keys(b).some(k=>!['state','version'].includes(k))||!['published','closed','revoked'].includes(String(b.state))||!Number.isInteger(b.version)||Number(b.version)<1)throw new QuestionnaireError('VALIDATION');
        res.json(await repo.state(user.uid,id,b.state as 'published'|'closed'|'revoked',Number(b.version)));return;
      }
      if(action==='submissions'&&submissionId){
        if(!operation&&req.method==='GET'){res.json(await repo.submission(user.uid,id,submissionId));return;}
        if(operation==='import'&&req.method==='POST'){
          const b=object(req.body);if(Object.keys(b).some(k=>!['questionId'].includes(k))||typeof b.questionId!=='string'||!safeId.test(b.questionId))throw new QuestionnaireError('VALIDATION');
          res.json(await repo.importAnswer(user.uid,name,id,submissionId,b.questionId));return;
        }
      }
      throw new QuestionnaireError('NOT_FOUND',404);
    }catch(error){next(error);}
  });
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    if(error instanceof QuestionnaireError){res.status(error.status).json({error:error.code});return;}
    const type=(error as {type?:string}).type;
    res.status(type==='entity.too.large'?413:type==='entity.parse.failed'?400:500).json({error:type==='entity.too.large'?'TOO_LARGE':type==='entity.parse.failed'?'VALIDATION':'UNAVAILABLE'});
  });return app;
}
