import { describe,it,expect } from 'vitest';
import { baselineItems,buildTree,groups,newProductItem,productError } from '../src/lib/product-tree';
describe('Product tree',()=>{
  const items=baselineItems(),tree=buildTree(items);
  it('imports the handover baseline: 6 actors, 14 modules, 104 submodules, all linked',()=>{
    expect([tree.actors.length,tree.modules.length,items.filter(i=>i.kind==='sub').length]).toEqual([6,14,104]);
    expect(new Set(items.map(i=>i.id)).size).toBe(items.length);
    expect(tree.modulesOf(tree.actors.find(a=>a.id==='a-admin')!)).toHaveLength(14);
    expect(tree.modules.filter(m=>!tree.usersOf(m).length)).toEqual([]);
    expect(tree.modulesWithSub('Role / permission')).toEqual(['m-auth','m-admin']);
  });
  it('fills every label in English, Vietnamese and Swedish',()=>{
    const labels=[...Object.values(groups),...items.flatMap(i=>i.kind==='actor'?[i.name,i.channel]:[i.name])];
    expect(labels.filter(l=>!l.en.trim()||!l.vi.trim()||!l.sv.trim())).toEqual([]);
  });
  it('drops links to deleted actors and submodules of deleted modules',()=>{
    const after=buildTree(items.filter(i=>i.id!=='a-driver'&&i.id!=='m-booking'));
    expect(after.usersOf(after.modules.find(m=>m.id==='m-auth')!).map(a=>a.id)).not.toContain('a-driver');
    expect(after.modules.some(m=>m.id==='m-booking')).toBe(false);
  });
  it('validates new items and appends them after their siblings',()=>{
    const sub=newProductItem('sub',items,{parentId:'m-booking'});
    expect(sub.order).toBe(8);expect(productError(sub)).toBe('ptNameRequired');
    expect(productError({...newProductItem('module',items),name:{en:'Fleet ops',vi:'',sv:''}})).toBe('ptGroupRequired');
  });
});
