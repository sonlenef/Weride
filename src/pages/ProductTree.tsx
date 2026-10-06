import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {PointerEvent,ReactNode} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {Building2,CarFront,CircleHelp,Hotel,MousePointerClick,Search,ShieldCheck,Smartphone,UsersRound,Webhook,X} from 'lucide-react';
import {actors,actorsUsing,groups,modules,modulesWithSub} from '../lib/product-tree';
import {text} from '../lib/i18n';
import type {Localized} from '../lib/types';
import './product-tree.css';
const icons:Record<string,typeof Smartphone>={passenger:Smartphone,driver:CarFront,hotel:Hotel,admin:ShieldCheck,fleet:Building2,partner:Webhook};
const order=Object.keys(modules);
const columns=(Object.keys(groups) as (keyof typeof groups)[]).map(g=>({g,keys:order.filter(k=>modules[k].group===g)}));
const wide='(min-width:1101px)';
type Focus={kind:'actor'|'module'|'sub';key:string}|null;
export default function ProductTree(){
  const {t,i18n}=useTranslation(),tx=(l:Localized)=>text(l,i18n.language);
  const [params,setParams]=useSearchParams(),[hover,setHover]=useState<Focus>(null),[preview,setPreview]=useState(''),[q,setQ]=useState('');
  const [edges,setEdges]=useState<{d:string;dashed:boolean}[]>([]),stage=useRef<HTMLDivElement>(null),band=useRef<HTMLElement>(null),anchors=useRef(new Map<string,HTMLElement>());
  const pinActor=actors.find(a=>a.key===params.get('actor')),pinModule=order.find(k=>k===params.get('module'))||'';
  const focus:Focus=hover??(pinModule?{kind:'module',key:pinModule}:pinActor?{kind:'actor',key:pinActor.key}:null),focusKey=focus?`${focus.kind}:${focus.key}`:'';
  const focusActor=focus?.kind==='actor'?actors.find(a=>a.key===focus.key):undefined;
  const litActors=new Set(focus?.kind==='actor'?[focus.key]:focus?.kind==='module'?actorsUsing(focus.key).map(a=>a.key):[]);
  const litModules=new Set(focusActor?focusActor.modules:focus?.kind==='module'?[focus.key]:focus?.kind==='sub'?modulesWithSub(focus.key):[]);
  const needle=q.trim().toLocaleLowerCase(),has=(l:Localized)=>!!needle&&(tx(l).toLocaleLowerCase().includes(needle)||l.en.toLocaleLowerCase().includes(needle));
  const matches=new Set(order.filter(k=>has(modules[k].name)||modules[k].subs.some(has)));
  const shown=hover?.kind==='module'?hover.key:pinModule||preview,shownModule=shown?modules[shown]:undefined;
  const hl=(s:string):ReactNode=>{const i=needle?s.toLocaleLowerCase().indexOf(needle):-1;return i<0?s:<>{s.slice(0,i)}<mark>{s.slice(i,i+needle.length)}</mark>{s.slice(i+needle.length)}</>;};
  const anchor=(id:string)=>(el:HTMLElement|null)=>{if(el)anchors.current.set(id,el);else anchors.current.delete(id);};
  const enter=(f:NonNullable<Focus>)=>{setHover(f);if(f.kind==='module')setPreview(f.key);};
  const hoverOn=(f:NonNullable<Focus>)=>({onPointerEnter:(e:PointerEvent)=>{if(e.pointerType==='mouse')enter(f);},onPointerLeave:(e:PointerEvent)=>{if(e.pointerType==='mouse')setHover(null);},onFocus:()=>enter(f),onBlur:()=>setHover(null)});
  const pin=(kind:'actor'|'module',key:string)=>{
    const next=new URLSearchParams(params),on=params.get(kind)!==key;next.delete('actor');next.delete('module');if(on)next.set(kind,key);setParams(next,{replace:true});
    if(kind==='module'&&on&&!matchMedia(wide).matches)requestAnimationFrame(()=>band.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'}));
  };
  // Edges exist only while something is focused (handover §30: no static many-to-many arrows). They land on each group's dot, where its spine starts.
  const measure=useCallback(()=>{
    const root=stage.current;if(!root||!focus||focus.kind==='sub'||!matchMedia(wide).matches){setEdges([]);return;}
    const box=root.getBoundingClientRect(),at=(id:string,top:boolean)=>{const r=anchors.current.get(id)?.getBoundingClientRect();return r&&{x:r.left+r.width/2-box.left,y:(top?r.top:r.bottom)-box.top};};
    const pairs=focus.kind==='actor'?columns.filter(c=>c.keys.some(k=>focusActor!.modules.includes(k))).map(c=>({a:focus.key,g:c.g,dashed:c.keys.filter(k=>focusActor!.modules.includes(k)).every(k=>focusActor!.indirect.includes(k))}))
      :actorsUsing(focus.key).map(a=>({a:a.key,g:modules[focus.key].group,dashed:a.indirect.includes(focus.key)}));
    setEdges(pairs.flatMap(({a,g,dashed})=>{const s=at('a:'+a,false),e=at('g:'+g,true);if(!s||!e)return [];const h=(e.y-s.y)*.55;return [{d:`M${s.x} ${s.y}C${s.x} ${s.y+h} ${e.x} ${e.y-h} ${e.x} ${e.y}`,dashed}];}));
  },[focusKey,i18n.language]);
  useLayoutEffect(()=>{measure();const ro=new ResizeObserver(measure);if(stage.current)ro.observe(stage.current);return()=>ro.disconnect();},[measure]);
  useEffect(()=>{const esc=(e:KeyboardEvent)=>{if(e.key!=='Escape')return;setHover(null);setPreview('');if(params.has('actor')||params.has('module')){const next=new URLSearchParams(params);next.delete('actor');next.delete('module');setParams(next,{replace:true});}};document.addEventListener('keydown',esc);return()=>document.removeEventListener('keydown',esc);},[params,setParams]);
  return <div className="page-enter pt-page">
    <div className="page-heading"><div><h1>{t('ptTitle')}</h1><p>{t('ptSubtitle')}</p></div></div>
    <div className="pt-bar">
      <p className="pt-note"><CircleHelp size={15}/>{t('ptAssumption')}</p>
      <label className="search-field pt-search"><Search size={17}/><input type="search" aria-label={t('ptFilter')} placeholder={t('ptFilter')} value={q} onChange={e=>setQ(e.target.value)}/>{q&&<button type="button" onClick={()=>setQ('')} aria-label={t('ptClear')}><X size={14}/></button>}</label>
    </div>
    <ul className="pt-legend">
      {columns.map(({g})=><li key={g}><i className={`pt-dot is-${g}`}/>{tx(groups[g])}</li>)}
      <li className="pt-legend-gap"><span className="pt-pip is-on"><UsersRound size={11}/></span>{t('ptUses')}</li>
      <li><span className="pt-pip is-indirect"><UsersRound size={11}/></span>{t('ptIndirect')}</li>
      <li><span className="pt-pip"><UsersRound size={11}/></span>{t('ptUnused')}</li>
    </ul>
    <div className={`pt-stage ${focus?'has-focus':''}`} ref={stage}>
      <svg className="pt-edges" aria-hidden="true">{edges.map((e,i)=><path key={focusKey+i} d={e.d} className={e.dashed?'is-dashed':undefined} pathLength={e.dashed?undefined:1}/>)}</svg>
      <div className="pt-root"><UsersRound size={17}/><strong>WeRide</strong><span>{t('ptCounts',{modules:order.length,subs:order.reduce((n,k)=>n+modules[k].subs.length,0)})}</span></div>
      <ul className="pt-actors">{actors.map(a=>{const Icon=icons[a.key],lit=litActors.has(a.key),dim=!!focus&&focus.kind!=='sub'&&!lit;
        return <li key={a.key}><button type="button" ref={anchor('a:'+a.key)} className={`pt-actor ${lit?'is-lit':''} ${dim?'is-dim':''}`} aria-pressed={pinActor===a} onClick={()=>pin('actor',a.key)} {...hoverOn({kind:'actor',key:a.key})}>
          <span className="pt-avatar"><Icon size={18}/></span><span className="pt-actor-text"><strong>{tx(a.name)}</strong><small>{tx(a.channel)}</small></span><span className="pt-actor-count">{t('ptModulesN',{count:a.modules.length})}</span>
        </button></li>;})}</ul>
      <div className="pt-columns">{columns.map(({g,keys})=>{const lastLit=keys.reduce((n,k,i)=>litModules.has(k)?i:n,-1);
        return <section key={g} className={`pt-col ${lastLit>=0?'is-lit':''}`} aria-labelledby={`pt-group-${g}`}>
          <h2 id={`pt-group-${g}`} className="pt-col-head"><i ref={anchor('g:'+g)} className={`pt-dot is-${g}`}/>{tx(groups[g])}<span>{keys.length}</span></h2>
          <ul className="pt-mods">{keys.map((k,i)=>{const m=modules[k],users=actorsUsing(k),lit=litModules.has(k),dim=(!!focus&&!lit)||(!!needle&&!matches.has(k));
            return <li key={k} className={`${lit?'is-lit':''} ${i<lastLit?'on-path':''} ${focusActor?.indirect.includes(k)?'is-indirect':''}`}>
              <button type="button" className={`pt-mod ${lit?'is-lit':''} ${dim?'is-dim':''} ${shown===k?'is-shown':''}`} aria-pressed={pinModule===k} onClick={()=>pin('module',k)} {...hoverOn({kind:'module',key:k})}>
                <span className="pt-mod-name">{hl(tx(m.name))}</span><span className="pt-mod-count">{m.subs.length}</span>
                <span className="pt-pips" aria-hidden="true">{actors.map(a=>{const Icon=icons[a.key],state=a.indirect.includes(k)?'is-indirect':a.modules.includes(k)?'is-on':'';return <span key={a.key} className={`pt-pip ${state}`} title={tx(a.name)}><Icon size={11}/></span>;})}</span>
                <span className="sr-only">{t('ptSharedBy',{count:users.length,names:users.map(a=>tx(a.name)+(a.indirect.includes(k)?` (${t('ptIndirect')})`:'')).join(', ')})}</span>
              </button></li>;})}</ul>
        </section>;})}</div>
      {needle&&!matches.size&&<p className="pt-nomatch">{t('ptNoMatch',{q:q.trim()})}</p>}
    </div>
    <section ref={band} className={`pt-band ${shownModule?'':'is-empty'}`} aria-label={shownModule?tx(shownModule.name):t('ptMenu')}>
      {shownModule?<>
        <div className="pt-band-head">
          <div className="pt-band-title"><span><i className={`pt-dot is-${shownModule.group}`}/>{tx(groups[shownModule.group])} · {t('ptSubsN',{count:shownModule.subs.length})}</span><h2>{hl(tx(shownModule.name))}</h2></div>
          <div className="pt-band-users"><strong>{t('ptUsedBy')}</strong>{actorsUsing(shown).map(a=>{const Icon=icons[a.key],indirect=a.indirect.includes(shown);return <span key={a.key} className={indirect?'is-indirect':undefined}><Icon size={13}/>{tx(a.name)}{indirect&&<em>{t('ptIndirect')}</em>}</span>;})}</div>
          {pinModule===shown&&<button type="button" className="icon-button" onClick={()=>pin('module',shown)} aria-label={t('ptUnpin')} title={t('ptUnpin')}><X size={18}/></button>}
        </div>
        <ul className="pt-subs">{shownModule.subs.map(s=>{const others=modulesWithSub(s.en).filter(k=>k!==shown);
          return <li key={s.en} className={`${has(s)?'is-match':''} ${others.length?'is-shared':''}`} tabIndex={others.length?0:undefined} {...(others.length?hoverOn({kind:'sub',key:s.en}):{})}>{hl(tx(s))}{others.length>0&&<small>{t('ptAlsoIn',{names:others.map(k=>tx(modules[k].name)).join(', ')})}</small>}</li>;})}</ul>
      </>:<p className="pt-band-empty"><MousePointerClick size={18}/>{t('ptEmpty')}</p>}
    </section>
  </div>;
}
