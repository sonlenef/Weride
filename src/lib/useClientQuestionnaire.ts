import {useEffect,useRef,useState} from 'react';
import {questionnaireRequest,newClientSecret,ClientApiError} from './client-questionnaire-http';
import {tokenPattern} from '../../functions/src/questionnaire-model';
import type {ClientAnswer,RespondentSession,QuestionnaireSnapshot,Publication,Locale} from '../../functions/src/questionnaire-model';
interface PublicView{snapshot:QuestionnaireSnapshot;expiresAt:string;dueDate:string;state:Publication['state'];}
interface StoredLocal{key:string;answers?:Record<string,ClientAnswer>;revision?:number;dirty?:boolean;expiresAt?:string;}
type State='loading'|'code'|'identity'|'response'|'unavailable';
export function useClientQuestionnaire(token:string){
  const storageName='weride.client-response.v1:'+token;
  const [view,setView]=useState<PublicView|null>(null),[stage,setStage]=useState<State>('loading');
  const [session,setSession]=useState<RespondentSession|null>(null),[answers,setAnswers]=useState<Record<string,ClientAnswer>>({});
  const [code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[dirty,setDirty]=useState(false),[storageLimited,setStorageLimited]=useState(false);
  const conflictLock=useRef(false),viewRequest=useRef(0);
  const key=useRef(''),local=useRef<StoredLocal|null>(null),sessionRef=useRef<RespondentSession|null>(null),answersRef=useRef(answers),saved=useRef(''),flight=useRef<Promise<RespondentSession|null>|null>(null);
  const persist=(current:Record<string,ClientAnswer>,revision:number,pending:boolean,expiresAt=view?.expiresAt)=>{
    const value:StoredLocal={key:key.current,answers:current,revision,dirty:pending,expiresAt};local.current=value;
    try{sessionStorage.setItem(storageName,JSON.stringify(value));}catch{setStorageLimited(true);}
  };
  const hydrate=(result:PublicView&{session:RespondentSession},ignoreLocal=false)=>{
    viewRequest.current++;setView(result);setSession(result.session);sessionRef.current=result.session;setStage('response');setError('');
    const s=result.session,cached=local.current;
    saved.current=JSON.stringify(s.answers);
    const recover=!ignoreLocal&&s.state==='draft'&&cached?.key===key.current&&cached.dirty&&cached.answers;
    const data=recover?cached.answers!:s.answers;answersRef.current=data;setAnswers(data);
    const changed=JSON.stringify(data)!==saved.current;setDirty(changed);
    conflictLock.current=Boolean(recover&&changed&&cached.revision!==s.revision);
    if(conflictLock.current)setError('CONFLICT');
    persist(data,conflictLock.current?cached!.revision||0:s.revision,changed,result.expiresAt);
  };
  const load=async(accessCode='')=>{
    const request=++viewRequest.current;
    setBusy(true);setError('');try{const result=await questionnaireRequest<PublicView>(`public/${token}/open`,{code:accessCode});if(request!==viewRequest.current)return;setView(result);setStage('identity');}
    catch(e){if(request!==viewRequest.current)return;const code=(e as Error).message;if(code==='CODE_REQUIRED'||code==='CODE_INVALID'){setStage('code');if(accessCode)setError(code);}else{setError(code);if((e as ClientApiError).status===404||(e as ClientApiError).status===410)setStage('unavailable');else setStage('code');}}finally{if(request===viewRequest.current)setBusy(false);}
  };
  useEffect(()=>{
    let active=true;
    if(!tokenPattern.test(token)){setStage('unavailable');return;}
    try{const raw=JSON.parse(sessionStorage.getItem(storageName)||'null');if(raw&&tokenPattern.test(raw.key))local.current=raw;}catch{setStorageLimited(true);}
    const fragment=new URLSearchParams(location.hash.slice(1)).get('resume');
    key.current=fragment&&tokenPattern.test(fragment)?fragment:local.current?.key||key.current||'';
    if(fragment&&tokenPattern.test(fragment)){if(local.current?.key!==fragment)local.current={key:fragment};try{sessionStorage.setItem(storageName,JSON.stringify(local.current));}catch{setStorageLimited(true);}}
    if(fragment)history.replaceState(null,'',location.pathname+location.search);
    void (async()=>{
      if(key.current){try{const r=await questionnaireRequest<PublicView&{session:RespondentSession}>(`public/${token}/session`,{key:key.current});if(active)hydrate(r);return;}
        catch(e){if(!active)return;if((e as ClientApiError).status===410){setStage('unavailable');return;}if((e as Error).message!=='SESSION'){setError((e as Error).message);}}}
      if(active)await load();
    })();return()=>{active=false;viewRequest.current++;};
  },[token]);
  const start=async(name:string,email:string,language:Locale,consent:boolean)=>{
    viewRequest.current++;setBusy(true);setError('');if(!key.current)key.current=newClientSecret();
    persist({},0,false);
    try{hydrate(await questionnaireRequest<PublicView&{session:RespondentSession}>(`public/${token}/start`,{key:key.current,code,identity:{name,email,language},consent}));}
    catch(e){setError((e as Error).message);if((e as Error).message==='CODE_REQUIRED'||(e as Error).message==='CODE_INVALID')setStage('code');}
    finally{setBusy(false);}
  };
  const change=(questionId:string,answer:ClientAnswer)=>{
    const next={...answersRef.current,[questionId]:answer};answersRef.current=next;setAnswers(next);setDirty(true);
    if(error!=='CONFLICT')setError('');persist(next,sessionRef.current?.revision||0,true);
  };
  const flush=async(submit=false):Promise<RespondentSession|null>=>{
    if(conflictLock.current)throw new ClientApiError('CONFLICT',409);
    if(flight.current){await flight.current;return flush(submit);}
    const s=sessionRef.current;if(!s||s.state==='submitted')return s;
    const captured=structuredClone(answersRef.current),signature=JSON.stringify(captured);
    if(!submit&&signature===saved.current)return s;
    setSaving(true);setError('');
    const operation=(async()=>{
      try{
        const result=await questionnaireRequest<RespondentSession>(`public/${token}/${submit?'submit':'save'}`,{key:key.current,revision:s.revision,answers:captured,...(submit?{confirm:true}:{})});
        sessionRef.current=result;setSession(result);saved.current=signature;
        const pending=JSON.stringify(answersRef.current)!==signature;setDirty(pending);persist(answersRef.current,result.revision,pending);
        return result;
      }catch(e){if((e as Error).message==='CONFLICT')conflictLock.current=true;setError((e as Error).message);if((e as ClientApiError).status===410)setView(old=>old?{...old,state:'revoked'}:old);if((e as Error).message==='CLOSED')setView(old=>old?{...old,state:'closed'}:old);throw e;}
      finally{setSaving(false);flight.current=null;}
    })();flight.current=operation;return operation;
  };
  useEffect(()=>{
    if(!session||session.state!=='draft'||!dirty||error==='CONFLICT'||view?.state!=='published')return;
    const timer=setTimeout(()=>{void flush().catch(()=>{});},1200);return()=>clearTimeout(timer);
  },[answers,session?.state,view?.state]);
  useEffect(()=>{
    if(!dirty&&!saving)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[dirty,saving]);
  const reloadServer=async()=>{
    setBusy(true);setError('');
    try{hydrate(await questionnaireRequest<PublicView&{session:RespondentSession}>(`public/${token}/session`,{key:key.current}),true);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const submit=async()=>{setBusy(true);try{await flush(true);setDirty(false);}finally{setBusy(false);}};
  const resumeLink=()=>`${location.origin}/respond/${token}#resume=${key.current}`;
  const clear=()=>{
    try{sessionStorage.removeItem(storageName);}catch{/* Browser may block storage. */}
    location.assign('/respond/'+token);
  };
  return {view,stage,session,answers,code,setCode,error,busy,saving,dirty,storageLimited,load,start,change,flush,submit,reloadServer,resumeLink,clear};
}
