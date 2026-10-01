import { clearUserDrafts } from './draft-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { OAuthProvider, onIdTokenChanged, signInWithPopup, signInWithRedirect, getRedirectResult, reauthenticateWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, authPersistenceReady, configured, devPreview, tenant } from './firebase';
import { accessDecision, authErrorKey } from './access';
import { announceSignOut, listenForSignOut } from './session-signals';
import { sessionExpiresAt } from '../../functions/src/session-policy';
interface Member {uid:string;name:string;email:string;}
interface AuthState {sessionUntil:number|null;renewSession:()=>Promise<void>;member:Member|null;loading:boolean;error:string;persistenceLimited:boolean;login:()=>Promise<void>;logout:()=>Promise<void>;preview:boolean;configured:boolean;}
const Context=createContext<AuthState|null>(null);
const previewMember={uid:'local-preview',name:'Madison reviewer',email:'preview@madison.dev'};
export function AuthProvider({children}:{children:ReactNode}) {
  const [member,setMember]=useState<Member|null>(devPreview?previewMember:null),[loading,setLoading]=useState(Boolean(auth)&&!devPreview);
  const [error,setError]=useState('');
  const [sessionUntil,setSessionUntil]=useState<number|null>(null),[persistenceLimited,setPersistenceLimited]=useState(false);
  const mounted=useRef(true), revision=useRef(0);
  const inspect=useCallback(async(user:User|null)=>{
    const version=++revision.current;
    const current=()=>mounted.current&&version===revision.current;
    if(!user){if(current()){setMember(null);setSessionUntil(null);setLoading(false);}return;}
    try {
      const result=await user.getIdTokenResult();
      if(!current()||auth?.currentUser?.uid!==user.uid)return;
      const decision=accessDecision(user.email,result.claims);
      if(decision==='member'){
        const expiresAt=sessionExpiresAt(result.claims);
        if(expiresAt===null||Date.now()>=expiresAt){
          setMember(null);setSessionUntil(null);await signOut(auth!);
          if(mounted.current)setError(expiresAt===null?'authSessionExpired':'authDayExpired');
          return;
        }
        setSessionUntil(expiresAt);
        setError('');
        setMember({uid:user.uid,name:user.displayName||user.email||'Madison',email:user.email!});
      }else{
        setMember(null);setSessionUntil(null);await signOut(auth!);if(mounted.current)setError(decision);
      }
    }catch(e){
      if(current()){setMember(null);setError(authErrorKey(e));}
    }finally{if(current())setLoading(false);}
  },[]);
  useEffect(()=>{
    mounted.current=true;
    if(!auth||devPreview)return;
    let active=true,unsub:(()=>void)|undefined;
    void authPersistenceReady.then(persistent=>{
      if(!active)return;setPersistenceLimited(!persistent);
      void getRedirectResult(auth!).catch(e=>{if(active)setError(authErrorKey(e));});
      unsub=onIdTokenChanged(auth!,user=>{void inspect(user);});
    });
    return()=>{active=false;mounted.current=false;revision.current++;unsub?.();};
  },[inspect]);
  useEffect(()=>{
    if(devPreview||!member||sessionUntil===null)return;
    const uid=member.uid;let closing=false;
    const checkExpiry=()=>{
      if(closing||Date.now()<sessionUntil||auth?.currentUser?.uid!==uid)return;
      closing=true;announceSignOut(uid,'expired');revision.current++;setMember(null);setSessionUntil(null);setError('authDayExpired');
      void signOut(auth).catch(()=>{if(mounted.current)setError('authSessionExpired');});
    };
    const timeout=setTimeout(checkExpiry,Math.max(0,sessionUntil-Date.now()));
    // Timers may be suspended while a laptop sleeps; recheck when the page resumes.
    const interval=setInterval(checkExpiry,60_000);
    window.addEventListener('focus',checkExpiry);window.addEventListener('pageshow',checkExpiry);
    document.addEventListener('visibilitychange',checkExpiry);checkExpiry();
    return()=>{clearTimeout(timeout);clearInterval(interval);window.removeEventListener('focus',checkExpiry);
      window.removeEventListener('pageshow',checkExpiry);document.removeEventListener('visibilitychange',checkExpiry);};
  },[member?.uid,sessionUntil]);
  useEffect(()=>{
    if(!auth||devPreview)return;
    // Also cover the first tab after migrating its old SESSION persistence to LOCAL.
    return listenForSignOut(message=>{
      if(auth?.currentUser?.uid!==message.uid)return;
      if(message.reason==='manual')clearUserDrafts(message.uid);
      revision.current++;setMember(null);setSessionUntil(null);setLoading(false);
      setError(message.reason==='expired'?'authDayExpired':'');
      void signOut(auth).catch(()=>{if(mounted.current)setError('authSessionExpired');});
    });
  },[]);
  const login=async()=>{
    if(!auth)return;setError('');
    const provider=new OAuthProvider('microsoft.com');
    provider.setCustomParameters({tenant,prompt:'select_account'});
    try{await authPersistenceReady;await signInWithPopup(auth,provider);}
    catch(e){if((e as {code?:string}).code==='auth/popup-blocked'){
      try{await signInWithRedirect(auth,provider);}catch(next){setError(authErrorKey(next));}
    }else setError(authErrorKey(e));}
  };
  const renewSession=async()=>{
    if(!auth?.currentUser)return;
    setError('');
    const provider=new OAuthProvider('microsoft.com');
    provider.setCustomParameters({tenant,prompt:'select_account'});
    try{await reauthenticateWithPopup(auth.currentUser,provider);}
    catch(e){setError(authErrorKey(e));}
  };
  const logout=async()=>{
    if(member)clearUserDrafts(member.uid);
    if(auth?.currentUser&&!devPreview)announceSignOut(auth.currentUser.uid,'manual');
    revision.current++;setMember(null);setSessionUntil(null);setError('');
    if(devPreview){location.assign(location.pathname);return;}
    if(auth)try{await signOut(auth);}catch(e){setError(authErrorKey(e));}
  };
  return <Context.Provider value={{member,loading,error,persistenceLimited,sessionUntil,renewSession,login,logout,preview:devPreview,configured}}>{children}</Context.Provider>;
}
export function useAuth(){const c=useContext(Context);if(!c)throw new Error('AuthProvider missing');return c;}
