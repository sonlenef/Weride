import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { actors,actorsOf,actorMapCsv,features } from '../src/lib/actor-map';
import type { Workspace } from '../src/lib/types';
const reqs=(JSON.parse(readFileSync('private/seed.json','utf8')) as Workspace).requirements,ids=reqs.map(r=>r.id);
describe('Actor map',()=>{
  it('maps only real requirements and gives every requirement at least one actor',()=>{
    for(const a of actors){expect(ids).toEqual(expect.arrayContaining(a.ids));expect(a.ids).toEqual(expect.arrayContaining(a.unsure));}
    expect(ids.filter(id=>!actorsOf(id).length)).toEqual([]);
    expect(actorsOf('FN-COM-01').map(a=>a.key)).toEqual(['actorPassenger','actorDriver','actorAdmin']);
  });
  it('puts every requirement in exactly one feature',()=>{
    expect(features.flatMap(f=>f.ids).sort()).toEqual([...ids].sort());
  });
  it('exports one CSV row per actor × requirement, honouring the filter',()=>{
    expect(actorMapCsv(reqs,()=>true,k=>k,'en').split('\r\n')).toHaveLength(51);
    const unsure=actorMapCsv(reqs,(a,id)=>a.unsure.includes(id),k=>k,'en').split('\r\n');
    expect(unsure).toHaveLength(6);expect(unsure.slice(1).every(l=>l.includes('"yes"'))).toBe(true);
  });
});
