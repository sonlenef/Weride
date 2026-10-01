from pathlib import Path
p=Path('src/pages/System.tsx');s=p.read_text()
s=s.replace("import { useState } from 'react';", "import {useSearchParams} from 'react-router-dom';")
s=s.replace("  const [selected,setSelected]=useState('booking'),[search,setSearch]=useState(''),[pic,setPic]=useState(''),[sorted,setSorted]=useState(false);",'''  const [params,setParams]=useSearchParams();
  const group=params.get('group')||'booking',selected=groups.some(g=>g.nodes.some(n=>n.key===group))?group:'booking';
  const search=params.get('q')||'',pic=params.get('pic')||'',sorted=params.get('sort')==='id';
  const update=(key:string,value:string)=>{const next=new URLSearchParams(params);value?next.set(key,value):next.delete(key);setParams(next,{replace:true});};
  const setSearch=(q:string)=>update('q',q),setPic=(p:string)=>update('pic',p),setSorted=(v:boolean)=>update('sort',v?'id':'');''')
s=s.replace("const selectGroup=(key:string)=>{setSelected(key);setSearch('');setPic('');};", "const selectGroup=(key:string)=>{const next=new URLSearchParams(params);next.set('group',key);for(const field of ['q','pic','open'])next.delete(field);setParams(next,{replace:true});};")
feedback='''<div className="system-selection-feedback"><span role="status">{t('uxSelectedGroup',{name:t(selection.key)})}</span><button className="button secondary small" onClick={()=>{
  const panel=document.getElementById('system-requirements-title');if(panel){panel.tabIndex=-1;panel.focus({preventScroll:true});panel.scrollIntoView({block:'start',behavior:'instant'});}
}}>{t('uxShowResults',{count:groupRows.length})}</button></div>'''
s=s.replace('<section className="system-canvas">',feedback+'<section className="system-canvas">')
s=s.replace("onClick={()=>{setSearch('');setPic('');}}", "onClick={()=>{const next=new URLSearchParams(params);next.delete('q');next.delete('pic');setParams(next,{replace:true});}}")
s=s.replace('<div className="table-footer"><span>','<div className="table-footer"><span role="status">')
p.write_text(s)
print('System selection, search, PIC and sort now survive reload; explicit results jump added.')
