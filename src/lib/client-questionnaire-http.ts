export class ClientApiError extends Error{constructor(code:string,public status=0){super(code);}}
export async function questionnaireRequest<T>(path:string,body?:unknown,idToken?:string):Promise<T>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),18000);
  try{
    const response=await fetch('/api/client-questionnaires/'+path,{
      method:body===undefined?'GET':'POST',cache:'no-store',credentials:'omit',signal:controller.signal,
      headers:{'X-Client-Request':'weride-questionnaire-v1',...(body===undefined?{}:{'Content-Type':'application/json'}),...(idToken?{Authorization:`Bearer ${idToken}`}:{})},
      body:body===undefined?undefined:JSON.stringify(body),
    });
    if(!response.headers.get('content-type')?.includes('application/json'))throw new ClientApiError('UNAVAILABLE',response.status);
    const result=await response.json();
    if(!response.ok)throw new ClientApiError(typeof result.error==='string'?result.error:'UNAVAILABLE',response.status);
    return result as T;
  }catch(error){if(error instanceof ClientApiError)throw error;throw new ClientApiError('NETWORK');}
  finally{clearTimeout(timeout);}
}
export function newClientSecret():string{
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
export async function copyClientText(value:string):Promise<void>{
  await navigator.clipboard.writeText(value);
}
