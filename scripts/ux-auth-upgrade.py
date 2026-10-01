from pathlib import Path
p=Path('src/lib/auth.tsx')
s=p.read_text()
s="import { clearUserDrafts } from './draft-storage';\n"+s
s=s.replace('getRedirectResult, signOut','getRedirectResult, reauthenticateWithPopup, signOut')
s=s.replace('interface AuthState {','interface AuthState {sessionUntil:number|null;renewSession:()=>Promise<void>;')
renew='''  const renewSession=async()=>{
    if(!auth?.currentUser)return;
    setError('');
    const provider=new OAuthProvider('microsoft.com');
    provider.setCustomParameters({tenant,prompt:'select_account'});
    try{await reauthenticateWithPopup(auth.currentUser,provider);}
    catch(e){setError(authErrorKey(e));}
  };
'''
s=s.replace('  const logout=async()=>{',renew+'''  const logout=async()=>{
    if(member)clearUserDrafts(member.uid);''')
s=s.replace('if(auth?.currentUser?.uid!==message.uid)return;',"if(auth?.currentUser?.uid!==message.uid)return;\n      if(message.reason==='manual')clearUserDrafts(message.uid);")
s=s.replace('value={{member,loading,error,persistenceLimited,','value={{member,loading,error,persistenceLimited,sessionUntil,renewSession,')
p.write_text(s)
print('Added session warning data and explicit Microsoft reauthentication. Existing access checks and 24-hour expiry remain unchanged.')
