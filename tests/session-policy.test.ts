import {describe,it,expect} from 'vitest';
import {SESSION_MAX_AGE_SECONDS,sessionExpiresAt,sessionIsCurrent} from '../functions/src/session-policy';
const now=1_800_000_000_000,second=1000,day=86_400_000;
describe('Absolute 24-hour session window',()=>{
  it('uses exactly one day from Firebase auth_time',()=>{
    expect(SESSION_MAX_AGE_SECONDS).toBe(86400);
    expect(sessionExpiresAt({auth_time:now/second},now)).toBe(now+day);
  });
  it('accepts an existing session until but not including the deadline',()=>{
    const claims={auth_time:now/second};
    expect(sessionIsCurrent(claims,now+day-1)).toBe(true);
    expect(sessionIsCurrent(claims,now+day)).toBe(false);
    expect(sessionIsCurrent(claims,now+day+1)).toBe(false);
  });
  it.each([undefined,null,false,'1800000000',0,-1,NaN,Infinity,1.1])('rejects invalid auth_time %s',value=>{
    expect(sessionExpiresAt({auth_time:value},now)).toBeNull();
    expect(sessionIsCurrent({auth_time:value},now)).toBe(false);
  });
  it('allows five minutes of clock skew but rejects an implausible future login',()=>{
    expect(sessionIsCurrent({auth_time:now/second+300},now)).toBe(true);
    expect(sessionIsCurrent({auth_time:now/second+301},now)).toBe(false);
  });
  it('token refresh and browser reopening do not reset the deadline',()=>{
    const original={auth_time:now/second,iat:now/second};
    const refreshed={...original,iat:now/second+86399,exp:now/second+90000};
    expect(sessionExpiresAt(refreshed,now+day-1)).toBe(now+day);
    expect(sessionIsCurrent(refreshed,now+day)).toBe(false);
  });
});
