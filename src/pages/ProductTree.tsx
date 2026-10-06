import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {CSSProperties,PointerEvent,ReactNode} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {ArrowRight,CarFront,CircleHelp,Download,LoaderCircle,MousePointerClick,Network,Pencil,Plus,Search,X} from 'lucide-react';
import {useWorkspace} from '../lib/store';
import {useAuth} from '../lib/auth';
import {buildTree,groupKeys,groups,newProductItem} from '../lib/product-tree';
import {text} from '../lib/i18n';
import type {Localized,ProductItem} from '../lib/types';
import {ProductEditor,Untranslated,actorIcon} from '../components/ProductEditors';
import {readableError} from '../components/Editors';
import './product-tree.css';
const wide='(min-width:1101px)';
type Focus={kind:'actor'|'module'|'sub';key:string}|null;
export default function ProductTree(){
  const {t,i18n}=useTranslation(),tx=(l:Localized)=>text(l,i18n.language),navigate=useNavigate();
  const {data,online,importProductBaseline}=useWorkspace(),{preview}=useAuth(),canEdit=online||preview;
  const [params,setParams]=useSearchParams(),[hover,setHover]=useState<Focus>(null),[peek,setPeek]=useState(''),[q,setQ]=useState('');
  const [editing,setEditing]=useState<ProductItem|null>(null),[seeding,setSeeding]=useState(false),[seedError,setSeedError]=useState('');
  const [edges,setEdges]=useState<{d:string;dashed:boolean}[]>([]),stage=useRef<HTMLDivElement>(null),anchors=useRef(new Map<string,HTMLElement>());
  const items=data?.productItems||[],tree=buildTree(items),columns=groupKeys.map(g=>({g,mods:tree.modules.filter(m=>m.group===g)}));
  const byId=new Map(items.map(i=>[i.id,i]));
  const pinActor=tree.actors.find(a=>a.id===params.get('actor'));
  const focus:Focus=hover??(pinActor?{kind:'actor',key:pinActor.id}:null),focusKey=focus?`${focus.kind}:${focus.key}`:'';
  const focusActor=focus?.kind==='actor'?byId.get(focus.key):undefined,focusModule=focus?.kind==='module'?byId.get(focus.key):undefined;
  const litActors=new Set(focusActor?[focusActor.id]:focusModule?tree.usersOf(focusModule).map(a=>a.id):[]);
  const litModules=new Set(focusActor?tree.modulesOf(focusActor).map(m=>m.id):focusModule?[focusModule.id]:focus?.kind==='sub'?tree.modulesWithSub(focus.key):[]);
  const needle=q.trim().toLocaleLowerCase(),has=(l:Localized)=>!!needle&&(tx(l).toLocaleLowerCase().includes(needle)||l.en.toLocaleLowerCase().includes(needle));
  const matches=new Set(tree.modules.filter(m=>has(m.name)||tree.subsOf(m.id).some(s=>has(s.name))).map(m=>m.id));
  const shownModule=byId.get(hover?.kind==='module'?hover.key:peek);
  const hl=(s:string):ReactNode=>{const i=needle?s.toLocaleLowerCase().indexOf(needle):-1;return i<0?s:<>{s.slice(0,i)}<mark>{s.slice(i,i+needle.length)}</mark>{s.slice(i+needle.length)}</>;};
  const anchor=(id:string)=>(el:HTMLElement|null)=>{if(el)anchors.current.set(id,el);else anchors.current.delete(id);};
  const enter=(f:NonNullable<Focus>)=>{setHover(f);if(f.kind==='module')setPeek(f.key);};
  const hoverOn=(f:NonNullable<Focus>)=>({onPointerEnter:(e:PointerEvent)=>{if(e.pointerType==='mouse')enter(f);},onPointerLeave:(e:PointerEvent)=>{if(e.pointerType==='mouse')setHover(null);},onFocus:()=>enter(f),onBlur:()=>setHover(null)});
  const pin=(id:string)=>{const next=new URLSearchParams(params);if(params.get('actor')===id)next.delete('actor');else next.set('actor',id);setParams(next,{replace:true});};
  const indirectFor=(a:ProductItem,m:ProductItem)=>m.indirect.includes(a.id);
  // Edges exist only while something is focused (handover §30: no static many-to-many arrows). They land on each group's dot, where its spine starts.
  const measure=useCallback(()=>{
    const root=stage.current;if(!root||!focus||focus.kind==='sub'||!matchMedia(wide).matches){setEdges([]);return;}
    const box=root.getBoundingClientRect(),at=(id:string,top:boolean)=>{const r=anchors.current.get(id)?.getBoundingClientRect();return r&&{x:r.left+r.width/2-box.left,y:(top?r.top:r.bottom)-box.top};};
    const pairs=focusActor?columns.filter(c=>c.mods.some(m=>m.actors.includes(focusActor.id))).map(c=>({a:focusActor.id,g:c.g as string,dashed:c.mods.filter(m=>m.actors.includes(focusActor.id)).every(m=>indirectFor(focusActor,m))}))
      :focusModule?tree.usersOf(focusModule).map(a=>({a:a.id,g:focusModule.group as string,dashed:indirectFor(a,focusModule)})):[];
    setEdges(pairs.flatMap(({a,g,dashed})=>{const s=at('a:'+a,false),e=at('g:'+g,true);if(!s||!e)return [];const h=(e.y-s.y)*.55;return [{d:`M${s.x} ${s.y}C${s.x} ${s.y+h} ${e.x} ${e.y-h} ${e.x} ${e.y}`,dashed}];}));
  },[focusKey,i18n.language,items]);// items: edits move nodes
  useLayoutEffect(()=>{measure();const ro=new ResizeObserver(measure);if(stage.current)ro.observe(stage.current);return()=>ro.disconnect();},[measure]);
  useEffect(()=>{const esc=(e:KeyboardEvent)=>{if(e.key!=='Escape'||editing)return;setHover(null);setPeek('');if(params.has('actor')){const next=new URLSearchParams(params);next.delete('actor');setParams(next,{replace:true});}};document.addEventListener('keydown',esc);return()=>document.removeEventListener('keydown',esc);},[params,setParams,editing]);
  const seed=async()=>{setSeeding(true);setSeedError('');try{await importProductBaseline();}catch(e){setSeedError(readableError(e));}finally{setSeeding(false);}};
  const head=<div className="pt-head">
    <div><h1>{t('ptTitle')}</h1><p>{t('ptSubtitle')}</p></div>
    {items.length>0&&<label className="search-field pt-search"><Search size={17}/><input type="search" aria-label={t('ptFilter')} placeholder={t('ptFilter')} value={q} onChange={e=>setQ(e.target.value)}/>{q&&<button type="button" onClick={()=>setQ('')} aria-label={t('ptClear')}><X size={14}/></button>}</label>}
  </div>;
  if(!items.length)return <div className="page-enter pt-page">{head}
    <section className="pt-seed"><span className="pt-seed-icon"><Network size={26}/></span><h2>{t('ptSeedTitle')}</h2><p>{t('ptSeedBody')}</p>
      <button type="button" className="button primary" disabled={!canEdit||seeding} onClick={()=>void seed()}>{seeding?<LoaderCircle className="spin" size={16}/>:<Download size={16}/>}{t(seeding?'saving':'ptSeed')}</button>
      {seedError&&<p className="error-banner" role="alert">{t(seedError)}</p>}</section></div>;
  return <div className="page-enter pt-page">{head}
    <div className="pt-bar"><p className="pt-note"><CircleHelp size={15}/>{t('ptAssumption')}</p><ul className="pt-legend">
      {groupKeys.map(g=><li key={g}><i className={`pt-dot is-${g}`}/>{tx(groups[g])}</li>)}
      <li className="pt-legend-gap"><span className="pt-pip is-on"><CarFront size={11}/></span>{t('ptUses')}</li>
      <li><span className="pt-pip is-indirect"><CarFront size={11}/></span>{t('ptIndirect')}</li>
      <li><span className="pt-pip"><CarFront size={11}/></span>{t('ptUnused')}</li>
    </ul></div>
    <div className={`pt-stage ${focus?'has-focus':''}`} ref={stage}>
      <svg className="pt-edges" aria-hidden="true">{edges.map((e,i)=><path key={focusKey+i} d={e.d} className={e.dashed?'is-dashed':undefined} pathLength={e.dashed?undefined:1}/>)}</svg>
      <div className="pt-root"><Network size={17}/><strong>WeRide</strong><span>{t('ptCounts',{modules:tree.modules.length,subs:tree.modules.reduce((n,m)=>n+tree.subsOf(m.id).length,0)})}</span></div>
      <ul className="pt-actors" style={{'--a':tree.actors.length} as CSSProperties}>{tree.actors.map(a=>{const Icon=actorIcon(a.id),lit=litActors.has(a.id),dim=!!focus&&focus.kind!=='sub'&&!lit;
        return <li key={a.id}><button type="button" ref={anchor('a:'+a.id)} className={`pt-actor ${lit?'is-lit':''} ${dim?'is-dim':''}`} aria-pressed={pinActor===a} onClick={()=>pin(a.id)} {...hoverOn({kind:'actor',key:a.id})}>
          <span className="pt-avatar"><Icon size={18}/></span><span className="pt-actor-text"><strong>{tx(a.name)}<Untranslated value={a.name}/></strong><small>{tx(a.channel)} <span className="pt-nowrap">· {t('ptModulesN',{count:tree.modulesOf(a).length})}</span></small></span>
        </button>{canEdit&&<button type="button" className="pt-edit" onClick={()=>setEditing(a)} aria-label={`${t('ptEditActor')}: ${tx(a.name)}`} title={t('ptEditActor')}><Pencil size={14}/></button>}</li>;})}
        {canEdit&&<li className="is-add"><button type="button" className="pt-add pt-add-actor" onClick={()=>setEditing(newProductItem('actor',items))} aria-label={t('ptAddActor')} title={t('ptAddActor')}><Plus size={18}/></button></li>}</ul>
      <div className="pt-columns">{columns.map(({g,mods})=>{const lastLit=mods.reduce((n,m,i)=>litModules.has(m.id)?i:n,-1);
        return <section key={g} className={`pt-col ${lastLit>=0?'is-lit':''}`} aria-labelledby={`pt-group-${g}`}>
          <h2 id={`pt-group-${g}`} className="pt-col-head"><i ref={anchor('g:'+g)} className={`pt-dot is-${g}`}/>{tx(groups[g])}<span>{mods.length}</span></h2>
          <ul className="pt-mods">{mods.map((m,i)=>{const users=tree.usersOf(m),subs=tree.subsOf(m.id),clarify=subs.filter(s=>s.status==='clarify').length,lit=litModules.has(m.id),dim=(!!focus&&!lit)||(!!needle&&!matches.has(m.id));
            return <li key={m.id} className={`${lit?'is-lit':''} ${i<lastLit?'on-path':''} ${focusActor&&indirectFor(focusActor,m)?'is-indirect':''}`}>
              <button type="button" className={`pt-mod ${lit?'is-lit':''} ${dim?'is-dim':''} ${shownModule===m?'is-shown':''}`} onClick={()=>navigate(`/product-tree/${encodeURIComponent(m.id)}`)} {...hoverOn({kind:'module',key:m.id})}>
                <span className="pt-mod-name">{hl(tx(m.name))}<Untranslated value={m.name}/></span>
                <span className="pt-pips" aria-hidden="true">{tree.actors.map(a=>{const Icon=actorIcon(a.id),state=!m.actors.includes(a.id)?'':indirectFor(a,m)?'is-indirect':'is-on';return <span key={a.id} className={`pt-pip ${state}`} title={tx(a.name)}><Icon size={11}/></span>;})}</span>
                <span className="pt-mod-meta">{clarify>0&&<span className="pt-clarify">{t('ptClarifyN',{count:clarify})}</span>}<span className="pt-mod-count">{t('ptSubsN',{count:subs.length})}</span></span>
                <span className="sr-only">{t('ptSharedBy',{count:users.length,names:users.map(a=>tx(a.name)+(indirectFor(a,m)?` (${t('ptIndirect')})`:'')).join(', ')})}</span>
              </button></li>;})}
            {canEdit&&<li className="is-add"><button type="button" className="pt-add" onClick={()=>setEditing(newProductItem('module',items,{group:g}))}><Plus size={15}/>{t('ptAddModule')}</button></li>}</ul>
        </section>;})}</div>
      {needle&&!matches.size&&<p className="pt-nomatch">{t('ptNoMatch',{q:q.trim()})}</p>}
    </div>
    <section className={`pt-band ${shownModule?'is-open':'is-empty'}`} aria-label={shownModule?tx(shownModule.name):t('ptMenu')}>
      {shownModule?<>
        <div className="pt-band-head">
          <h2 className="pt-band-title"><i className={`pt-dot is-${shownModule.group}`}/>{hl(tx(shownModule.name))}<Untranslated value={shownModule.name}/><small>{tx(groups[shownModule.group as keyof typeof groups])} · {t('ptSubsN',{count:tree.subsOf(shownModule.id).length})}</small></h2>
          <Link className="button secondary small" to={`/product-tree/${encodeURIComponent(shownModule.id)}`}>{t('ptOpenModule')}<ArrowRight size={15}/></Link>
          <div className="pt-band-users"><strong>{t('ptUsedBy')}</strong>{tree.usersOf(shownModule).map(a=>{const Icon=actorIcon(a.id),indirect=indirectFor(a,shownModule);return <span key={a.id} className={indirect?'is-indirect':undefined}><Icon size={13}/>{tx(a.name)}{indirect&&<em>{t('ptIndirect')}</em>}</span>;})}</div>
        </div>
        <ul className="pt-subs">{tree.subsOf(shownModule.id).map(s=>{const others=tree.modulesWithSub(s.name.en).filter(k=>k!==shownModule.id);
          return <li key={s.id} className={`${has(s.name)?'is-match':''} ${others.length?'is-shared':''} ${s.status==='clarify'?'is-clarify':''}`} tabIndex={others.length?0:undefined} {...(others.length?hoverOn({kind:'sub',key:s.name.en}):{})}>{hl(tx(s.name))}<Untranslated value={s.name}/>{others.length>0&&<small>{t('ptAlsoIn',{names:others.map(k=>tx(byId.get(k)!.name)).join(', ')})}</small>}</li>;})}</ul>
      </>:<p className="pt-band-empty"><MousePointerClick size={18}/>{t('ptEmpty')}</p>}
    </section>
    {editing&&<ProductEditor initial={editing} onClose={()=>setEditing(null)} onSaved={i=>{if(i.kind==='module'&&i.version===1)navigate(`/product-tree/${encodeURIComponent(i.id)}`);}}/>}
  </div>;
}
