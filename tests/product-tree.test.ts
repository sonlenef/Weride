import { describe,it,expect } from 'vitest';
import { actors,actorsUsing,groups,modules,modulesWithSub } from '../src/lib/product-tree';
describe('Product tree',()=>{
  it('keeps the handover baseline: 6 actors, 14 modules, all linked',()=>{
    const keys=Object.keys(modules);
    expect(actors).toHaveLength(6);expect(keys).toHaveLength(14);
    for(const a of actors){expect(keys).toEqual(expect.arrayContaining(a.modules));expect(a.modules).toEqual(expect.arrayContaining(a.indirect));}
    expect(actors.find(a=>a.key==='admin')!.modules).toEqual(keys);
    expect(keys.filter(k=>!actorsUsing(k).length)).toEqual([]);
    expect(modulesWithSub('Role / permission')).toEqual(['auth','admin']);
  });
  it('fills every label in English, Vietnamese and Swedish',()=>{
    const labels=[...Object.values(groups),...actors.flatMap(a=>[a.name,a.channel]),...Object.values(modules).flatMap(m=>[m.name,...m.subs])];
    expect(labels.filter(l=>!l.en.trim()||!l.vi.trim()||!l.sv.trim())).toEqual([]);
  });
});
