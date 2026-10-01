import {spawn} from 'node:child_process';
/** Official Firebase CLI manages credentials; no tokens are extracted or stored here. */
export async function openMaintenanceClient(){
  const child=spawn('firebase',['mcp','--only','core,firestore','--dir',process.cwd()],{stdio:['pipe','pipe','pipe']});
  let buffer='',next=0;const pending=new Map();
  child.stdout.on('data',chunk=>{buffer+=chunk;let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);try{const m=JSON.parse(line),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(new Error('Firebase CLI request failed')):p.resolve(m.result);}}catch{}}});
  child.on('exit',()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Firebase CLI stopped'));}pending.clear();});
  const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject,timer:setTimeout(()=>{pending.delete(id);reject(new Error('Firebase CLI timeout'));},60000)});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
  const call=async(name,args={})=>{const r=await rpc('tools/call',{name,arguments:args});if(r.isError)throw new Error('Firebase operation failed: '+(r.content?.find(c=>c.type==='text')?.text||name));return r;};
  try{await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'weride-maintenance',version:'1.0'}});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');}catch(e){child.kill();throw e;}
  return {rpc,call,close:()=>child.kill()};
}
