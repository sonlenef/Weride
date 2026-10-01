import {useSearchParams} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowRight, Download, Search, X, Building2, CarFront, ChartNoAxesCombined, CreditCard, GitBranch, Hotel, KeyRound, MapPinned, MessageSquareText, Network, Plane, ReceiptText, ShieldCheck, Smartphone, Sparkles, UsersRound } from 'lucide-react';
import { useWorkspace } from '../lib/store';
import { useAuth } from '../lib/auth';
import { filterByPic, memberLabel } from '../lib/assignment';
import { download, matrixCsv } from '../lib/helpers';
import { Badge } from '../components/ui';
import RequirementsTable from '../components/RequirementsTable';
const groups=[
  {layer:'channels',nodes:[{key:'passenger',icon:Smartphone,ids:['FN-PAS-01','FN-PAS-02','FN-VOU-01']},{key:'driver',icon:CarFront,ids:['FN-DRV-01','FN-DRV-02']},{key:'hotel',icon:Hotel,ids:['FN-HTL-01']},{key:'carrier',icon:Building2,ids:['FN-SUP-01']},{key:'partners',icon:Network,ids:['FN-BKG-01']}]},
  {layer:'corePlatform',nodes:[{key:'booking',icon:GitBranch,ids:['FN-BKG-01','FN-BKG-02','FN-VOU-01']},{key:'dispatch',icon:MapPinned,ids:['FN-DIS-01','FN-DIS-02']},{key:'payments',icon:CreditCard,ids:['FN-PAS-02','REG-SWE-03']},{key:'communication',icon:MessageSquareText,ids:['FN-COM-01']}]},
  {layer:'trustLayer',nodes:[{key:'humanOversight',icon:UsersRound,ids:['REG-PWD-01','REG-PWD-02','REG-PWD-03','REG-PWD-04','REG-PWD-05']},{key:'taxReporting',icon:ReceiptText,ids:['REG-DAC-01','REG-DAC-02','REG-DAC-03']},{key:'fiscal',icon:ShieldCheck,ids:['REG-SWE-01','REG-SWE-02']},{key:'sso',icon:KeyRound,ids:['FN-INT-01']}]},
  {layer:'expansionLayer',nodes:[{key:'predictive',icon:ChartNoAxesCombined,ids:['EXP-AI-01']},{key:'flights',icon:Plane,ids:['EXP-FLT-01']},{key:'m365',icon:Network,ids:['EXP-M365-01','EXP-M365-02']},{key:'experience',icon:Sparkles,ids:['EXP-PAS-01','EXP-DRV-01']}]},
];
export default function SystemPage(){
  const {data}=useWorkspace(),{member}=useAuth(),{t,i18n}=useTranslation();
  const [params,setParams]=useSearchParams();
  const group=params.get('group')||'booking',selected=groups.some(g=>g.nodes.some(n=>n.key===group))?group:'booking';
  const search=params.get('q')||'',pic=params.get('pic')||'',sorted=params.get('sort')==='id';
  const update=(key:string,value:string)=>{const next=new URLSearchParams(window.location.search);value?next.set(key,value):next.delete(key);setParams(next,{replace:true});};
  const setSearch=(q:string)=>update('q',q),setPic=(p:string)=>update('pic',p),setSorted=(v:boolean)=>update('sort',v?'id':'');
  const selection=groups.flatMap(g=>g.nodes).find(n=>n.key===selected)!;
  const d=data!,needle=search.trim().toLocaleLowerCase();
  const groupRows=d.requirements.filter(r=>selection.ids.includes(r.id));
  const matches=groupRows.filter(r=>!needle||[r.id,...Object.values(r.title),...Object.values(r.description),...d.entries.filter(e=>e.requirementId===r.id).flatMap(e=>[...Object.values(e.title),...Object.values(e.body),...Object.values(e.answer)])].join(' ').toLocaleLowerCase().includes(needle));
  const filtered=filterByPic(matches,d.assignments||[],pic,member?.uid||'');
  const rows=sorted?[...filtered].sort((a,b)=>a.id.localeCompare(b.id)):filtered;
  const selectGroup=(key:string)=>{const next=new URLSearchParams(window.location.search);next.set('group',key);for(const field of ['q','pic','open'])next.delete(field);setParams(next,{replace:true});};
  return <div className="page-enter"><div className="page-heading"><div><span className="eyebrow">WERIDE / {t('system')}</span><h1>{t('systemTitle')}</h1><p>{t('systemSubtitle')}</p></div><Badge tone="blue">{t('proposal')}</Badge></div>
    <div className="system-selection-feedback"><span role="status">{t('uxSelectedGroup',{name:t(selection.key)})}</span><button className="button secondary small" onClick={()=>{
  const panel=document.getElementById('system-requirements-title');if(panel){panel.tabIndex=-1;panel.focus({preventScroll:true});panel.scrollIntoView({block:'start',behavior:'instant'});}
}}>{t('uxShowResults',{count:groupRows.length})}</button></div><section className="system-canvas">{groups.map((g,index)=><div key={g.layer}><div className={`system-layer layer-${index}`}><div className="system-layer-title"><span className="layer-number">0{index+1}</span><h2>{t(g.layer)}</h2><Badge tone={index===3?'purple':'green'}>{index===3?'L2':'L1'}</Badge></div><div className={`system-nodes nodes-${g.nodes.length}`}>{g.nodes.map(({key,icon:Icon,ids})=><button aria-pressed={selected===key} aria-controls="system-requirements" key={key} onClick={()=>selectGroup(key)} className={`system-node ${selected===key?'selected':''}`}><Icon size={25}/><strong>{t(key)}</strong><span>{ids.length} {t('requirements')}<ArrowRight size={13}/></span></button>)}</div></div>{index<3&&<div className="system-connector"><span/><ArrowDown size={17}/><span/></div>}</div>)}</section>
    <section className="matrix-panel system-requirements" id="system-requirements" aria-labelledby="system-requirements-title">
      <header className="system-requirements-heading"><div><h2 id="system-requirements-title">{t(selection.key)} <Badge>{groupRows.length} {t('requirements')}</Badge></h2><p>{t('systemListHint')}</p></div><button type="button" className="button secondary" disabled={!rows.length} onClick={()=>download(`weride-${selected}.csv`,matrixCsv(rows,d,i18n.language),'text/csv;charset=utf-8')}><Download size={16}/>{t('systemListExport')}</button></header>
      <div className="matrix-toolbar"><label className="search-field"><Search size={17}/><input aria-label={t('systemListSearch')} placeholder={t('search')} value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button onClick={()=>setSearch('')} aria-label={t('resetFilters')}><X size={14}/></button>}</label><div className="matrix-filters"><select aria-label={t('picFilter')} value={pic} onChange={e=>setPic(e.target.value)}><option value="">{t('picAll')}</option><option value="mine">{t('picMine')}</option><option value="unassigned">{t('picUnassigned')}</option>{[...(d.members||[])].sort((a,b)=>memberLabel(a).localeCompare(memberLabel(b))).map(p=><option key={p.uid} value={`uid:${p.uid}`}>{memberLabel(p)}{!p.active?` · ${t('picInactive')}`:''}</option>)}</select>{(search||pic)&&<button className="button secondary small" onClick={()=>{const next=new URLSearchParams(window.location.search);next.delete('q');next.delete('pic');setParams(next,{replace:true});}}>{t('resetFilters')}</button>}</div></div>
      <RequirementsTable rows={rows} onSort={()=>setSorted(!sorted)} sorted={sorted}/>
      <div className="table-footer"><span role="status">{t('showing',{count:rows.length,total:groupRows.length})}</span><span className="table-source">{t('sourceReadOnly')}</span></div>
    </section>
  </div>;
}
