import { describe,it,expect } from 'vitest';
import { accessDecision,authErrorKey } from '../src/lib/access';
const email='member@madison.dev';
const base={email,email_verified:true,firebase:{sign_in_provider:'microsoft.com'}};
describe('Microsoft access gate regression',()=>{
  it('accepts Microsoft plus matching exact-domain signed email',()=>expect(accessDecision(email,base)).toBe('member'));
  it.each([false,undefined,null,'true',1])('does not require the Firebase email_verified value %s',value=>{
    expect(accessDecision(email,{...base,email_verified:value})).toBe('member');
  });
  it('allows case-insensitive email matching',()=>expect(accessDecision('MEMBER@MADISON.DEV',base)).toBe('member'));
  it('rejects another domain even when verified',()=>expect(accessDecision('member@other.dev',{...base,email:'member@other.dev'})).toBe('authDomainDenied'));
  it('rejects lookalikes and whitespace',()=>{
    for(const bad of ['member@madison.dev.evil.com','member@sub.madison.dev','member@madisonXdev','member@madison.dev '])
      expect(accessDecision(bad,{...base,email:bad})).toBe('authDomainDenied');
  });
  it.each(['google.com','password','custom','anonymous'])('rejects %s even with a verified Madison email',provider=>{
    expect(accessDecision(email,{...base,firebase:{sign_in_provider:provider}})).toBe('authProviderDenied');
  });
  it('rejects missing provider, missing email and profile mismatch separately',()=>{
    expect(accessDecision(email,{email,email_verified:true})).toBe('authProviderDenied');
    expect(accessDecision(null,base)).toBe('authMissingEmail');
    expect(accessDecision(email,{...base,email:null})).toBe('authMissingEmail');
    expect(accessDecision('another@madison.dev',base)).toBe('authSessionMismatch');
  });
  it('maps actionable errors without exposing raw messages or tokens',()=>{
    expect(authErrorKey({code:'auth/too-many-requests'})).toBe('authRateLimited');
    expect(authErrorKey({code:'auth/network-request-failed'})).toBe('authNetworkError');
    expect(authErrorKey({message:'private'})).toBe('authError');
  });
});
