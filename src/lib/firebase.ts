import { initializeApp } from 'firebase/app';
import { initializeAuth, browserPopupRedirectResolver, inMemoryPersistence, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
const env=import.meta.env;
export const configured=Boolean(env.VITE_FIREBASE_API_KEY&&env.VITE_FIREBASE_AUTH_DOMAIN&&env.VITE_FIREBASE_PROJECT_ID&&env.VITE_FIREBASE_APP_ID);
export const app=configured?initializeApp({apiKey:env.VITE_FIREBASE_API_KEY,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,projectId:env.VITE_FIREBASE_PROJECT_ID,appId:env.VITE_FIREBASE_APP_ID}):null;
export const microsoftReady=env.VITE_MICROSOFT_AUTH_READY==='true';
export const auth=app&&microsoftReady?initializeAuth(app,{persistence:[browserLocalPersistence,browserSessionPersistence,inMemoryPersistence],popupRedirectResolver:browserPopupRedirectResolver}):null;
// Firebase owns credential persistence. The signed auth_time still bounds access to 24 hours.
export const authPersistenceReady:Promise<boolean>=auth?(async()=>{
  try{await setPersistence(auth,browserLocalPersistence);return true;}
  catch{try{await setPersistence(auth,browserSessionPersistence);}catch{/* Keep available SDK storage. */}return false;}
})():Promise.resolve(false);
export const tenant=env.VITE_MICROSOFT_TENANT_ID||'madison.dev';
export const devPreview=import.meta.env.DEV&&new URLSearchParams(location.search).get('preview')==='1';
