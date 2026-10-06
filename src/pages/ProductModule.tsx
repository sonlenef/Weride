import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {ArrowLeft,ChevronLeft,ChevronRight,History,Pencil,Plus,Trash2} from 'lucide-react';
import {useWorkspace} from '../lib/store';
import {useAuth} from '../lib/auth';
import {baselineIds,buildTree,groups,newProductItem} from '../lib/product-tree';
import {fieldChanges} from '../lib/history';
import {formatDate,text} from '../lib/i18n';
import type {Activity,ProductItem} from '../lib/types';
import {LocalText} from '../components/ui';
import {Byline,ProductDeleteDialog,ProductEditor,ProductStatusBadge,SubForm,Untranslated,actorIcon} from '../components/ProductEditors';
import './product-tree.css';
const snapshot=(e:Activity)=>(e.after||e.before||{}) as Partial<ProductItem>;
export default function ProductModulePage(){
  const {id}=useParams(),{t,i18n}=useTranslation(),navigate=useNavigate();
  const {data,online}=useWorkspace(),{preview}=useAuth(),canEdit=online||preview;
  const addButton=useRef<HTMLButtonElement>(null),settle=(fn:()=>void)=>{fn();requestAnimationFrame(()=>addButton.current?.focus({preventScroll:true}));};
  const [editingModule,setEditingModule]=useState(false),[editingSub,setEditingSub]=useState(''),[adding,setAdding]=useState(false),[deleting,setDeleting]=useState<ProductItem|null>(null);
  const items=data?.productItems||[],tree=buildTree(items),m=tree.modules.find(x=>x.id===id);
  useEffect(()=>{setEditingModule(false);setEditingSub('');setAdding(false);setDeleting(null);},[id]);
  useEffect(()=>{document.title=`${m?text(m.name,i18n.language):t('ptMenu')} · WeRide Discovery`;return()=>{document.title='WeRide · Discovery Workspace';};},[m,i18n.language,t]);
  if(!m)return <div className="empty-state"><h1>{t('ptModuleMissing')}</h1><Link to="/product-tree">{t('ptMenu')}</Link></div>;
  const index=tree.modules.indexOf(m),prev=tree.modules[index-1],next=tree.modules[index+1];
  const subs=tree.subsOf(m.id),users=tree.usersOf(m),clarify=subs.filter(s=>s.status==='clarify').length;
  const history=(data?.activities||[]).filter(e=>e.kind==='product'&&(e.entryId===m.id||snapshot(e).parentId===m.id||e.entryId==='product-baseline'&&baselineIds.has(m.id)));
  const tx=(l:ProductItem['name'])=>text(l,i18n.language);
  return <div className="page-enter pm-page">
    <div className="detail-navigation"><Link to="/product-tree"><ArrowLeft size={16}/>{t('ptMenu')}</Link><div>
      {prev&&<Link to={`/product-tree/${encodeURIComponent(prev.id)}`} aria-label={t('previous')}><ChevronLeft size={16}/>{tx(prev.name)}<Untranslated value={prev.name}/></Link>}
      {next&&<Link to={`/product-tree/${encodeURIComponent(next.id)}`} aria-label={t('next')}>{tx(next.name)}<Untranslated value={next.name}/><ChevronRight size={16}/></Link>}</div></div>
    <header className="pm-head">
      <div className="pm-head-main">
        <h1><i className={`pt-dot is-${m.group}`}/><LocalText value={m.name} showFallback/></h1>
        <div className="pm-meta"><ProductStatusBadge status={m.status}/><span>{tx(groups[m.group as keyof typeof groups])}</span><span>{t('ptSubsN',{count:subs.length})}</span>{clarify>0&&<span className="pt-clarify">{t('ptClarifyN',{count:clarify})}</span>}</div>
        {Object.values(m.description).some(v=>v.trim())&&<LocalText as="p" className="pm-desc" value={m.description}/>}
        <Byline item={m}/>
      </div>
      {canEdit&&<button type="button" className="button secondary" onClick={()=>setEditingModule(true)}><Pencil size={15}/>{t('ptEditModule')}</button>}
    </header>
    <section className="pm-users" aria-labelledby="pm-users"><h2 id="pm-users">{t('ptUsedBy')}</h2>
      <ul>{tree.actors.map(a=>{const Icon=actorIcon(a.id),on=m.actors.includes(a.id),indirect=on&&m.indirect.includes(a.id);return <li key={a.id} className={!on?'is-off':indirect?'is-indirect':undefined}><Link to={`/product-tree?actor=${encodeURIComponent(a.id)}`} aria-label={`${tx(a.name)}: ${t(!on?'ptUnused':indirect?'ptIndirect':'ptUses')}`}><Icon size={14}/>{tx(a.name)}<Untranslated value={a.name}/>{indirect&&<em>{t('ptIndirect')}</em>}</Link></li>;})}</ul>{!users.length&&<p className="muted">{t('ptNoActors')}</p>}
    </section>
    <section className="panel pm-subs" aria-labelledby="pm-subs">
      <div className="pm-section-head"><h2 id="pm-subs">{t('ptSubmodules')} <span>{subs.length}</span></h2></div>
      <ol className="pm-list">{subs.map(s=>editingSub===s.id?<li key={s.id} className="pm-row is-editing"><SubForm initial={s} onDone={()=>settle(()=>setEditingSub(''))}/></li>:
        <li key={s.id} className={`pm-row ${s.status==='clarify'?'is-clarify':''}`}>
          <div className="pm-row-main"><LocalText value={s.name} className="pm-row-name" showFallback/>{Object.values(s.description).some(v=>v.trim())&&<LocalText as="p" value={s.description}/>}<Byline item={s} short/></div>
          <ProductStatusBadge status={s.status}/>
          {canEdit&&<div className="pm-row-actions"><button type="button" className="icon-button" onClick={()=>{setAdding(false);setEditingSub(s.id);}} aria-label={`${t('edit')}: ${tx(s.name)}`} title={t('edit')}><Pencil size={15}/></button><button type="button" className="icon-button pm-danger" onClick={()=>setDeleting(s)} aria-label={`${t('delete')}: ${tx(s.name)}`} title={t('delete')}><Trash2 size={15}/></button></div>}
        </li>)}
        {adding&&<li className="pm-row is-editing"><SubForm initial={newProductItem('sub',items,{parentId:m.id})} onDone={()=>settle(()=>setAdding(false))}/></li>}
      </ol>
      {!subs.length&&!adding&&<p className="pm-empty">{t('ptEmptySubs')}</p>}
      {canEdit&&!adding&&<button ref={addButton} type="button" className="pt-add pm-add" onClick={()=>{setEditingSub('');setAdding(true);}}><Plus size={15}/>{t('ptAddSub')}</button>}
    </section>
    <section className="panel pm-history" aria-labelledby="pm-history">
      <div className="pm-section-head"><h2 id="pm-history"><History size={17}/>{t('ptHistory')}</h2></div>
      {history.length?<ol>{history.map(e=>{const changes=e.action==='update'?fieldChanges(e.before,e.after):[];
        return <li key={e.id}><span className="avatar">{e.actorName.split(' ').slice(0,2).map(w=>w[0]).join('')}</span><div>
          <p><strong>{e.actorName}</strong> {t(e.action==='delete'?'deletedAction':e.action)} <span className="pm-history-item">{text(e.title,i18n.language)}</span></p>
          <time>{formatDate(e.at,i18n.language,true)}</time>
          {changes.length>0&&<p className="pm-history-fields">{[...new Set(changes.map(c=>c.field.split('.')[0]))].map(f=>t({name:'ptName',description:'details',status:'status',group:'ptGroup',channel:'ptChannel',actors:'ptActorsField',indirect:'ptIndirect',originalLocale:'uxSourceLanguage'}[f]||f)).join(' · ')}</p>}
        </div></li>;})}</ol>:<p className="pm-empty">{t('ptNoHistory')}</p>}
    </section>
    {editingModule&&<ProductEditor initial={m} onClose={()=>setEditingModule(false)} onDeleted={()=>navigate('/product-tree')}/>}
    {deleting&&<ProductDeleteDialog item={deleting} onClose={()=>setDeleting(null)}/>}
  </div>;
}
