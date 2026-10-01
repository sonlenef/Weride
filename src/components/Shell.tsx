import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Link,NavLink,Outlet,useLocation,useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {MessageSquareText,Sparkles,Activity,ArrowUpRight,BookOpen,ChevronRight,CircleHelp,LayoutDashboard,ListChecks,LogOut,Menu,Network,Search,ShieldCheck,UsersRound,X} from 'lucide-react';
import {Brand,LocaleSwitch,Spinner} from './ui';
import {useAuth} from '../lib/auth';
import {useWorkspace} from '../lib/store';
import {useDensity} from '../lib/preferences';
import type {Density} from '../lib/preferences';
import DraftShelf from './DraftShelf';
import RouteEffects from './RouteEffects';
export default function Shell(){
  const {t}=useTranslation(),{member,preview,logout,persistenceLimited,sessionUntil,renewSession,error:authError}=useAuth();
  const {data,loading,error,online,retry,syncStatus,lastSyncedAt}=useWorkspace();
  const location=useLocation(),navigate=useNavigate();const [mobile,setMobile]=useState(false),[small,setSmall]=useState(()=>matchMedia('(max-width:800px)').matches);
  const [search,setSearch]=useState(''),[clock,setClock]=useState(Date.now()),[renewing,setRenewing]=useState(false),[density,setDensity]=useDensity();
  const sidebar=useRef<HTMLElement>(null),menuButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const media=matchMedia('(max-width:800px)'),change=()=>{setSmall(media.matches);setMobile(false);};media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{setMobile(false);if(location.pathname==='/search')setSearch(new URLSearchParams(location.search).get('q')||'');if(preview&&!new URLSearchParams(location.search).has('preview')){const params=new URLSearchParams(location.search);params.set('preview','1');navigate({pathname:location.pathname,search:params.toString(),hash:location.hash},{replace:true,state:location.state});}},[location.pathname,location.search,preview,navigate]);
  useLayoutEffect(()=>{
    if(!small||!mobile)return;const node=sidebar.current!;
    const controls=()=>[...node.querySelectorAll<HTMLElement>('a,button,input,select,textarea,[tabindex="0"]')].filter(el=>!el.hasAttribute('disabled')&&el.getClientRects().length>0);
    controls()[0]?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    const handle=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setMobile(false);}if(e.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(!node.contains(document.activeElement)||e.shiftKey&&document.activeElement===first||!e.shiftKey&&document.activeElement===last){e.preventDefault();(e.shiftKey?last:first)?.focus();}}};
    document.addEventListener('keydown',handle);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',handle);menuButton.current?.focus({preventScroll:true});};
  },[small,mobile]);
  const nav=[{to:'/',label:'overview',icon:LayoutDashboard},{to:'/requirements',label:'matrix',icon:ListChecks},{to:'/questions',label:'qhMenu',icon:MessageSquareText},{to:'/client-questions',label:'cqMenu',icon:MessageSquareText},{to:'/review-packs',label:'aiPacks',icon:Sparkles},{to:'/system',label:'system',icon:Network},{to:'/actors',label:'actorMap',icon:UsersRound},{to:'/activity',label:'activity',icon:Activity},{to:'/sources',label:'sourceNotes',icon:BookOpen}];
  const section=location.pathname==='/search'?'uxSearchResults':nav.find(n=>n.to==='/'?location.pathname==='/':location.pathname.startsWith(n.to))?.label||'workspace';
  const minutes=sessionUntil?Math.max(0,Math.ceil((sessionUntil-clock)/60000)):null;
  return <div className="app-shell">
    <a className="skip-link" href="#main" onClick={()=>document.getElementById('main')?.focus()}>{t('uxSkip')}</a>
    {small&&mobile&&<button className="sidebar-backdrop" tabIndex={-1} onClick={()=>setMobile(false)} aria-label={t('close')}/>}
    <aside id="workspace-navigation" ref={sidebar} className={`sidebar ${mobile?'is-open':''}`} inert={small&&!mobile} aria-hidden={small&&!mobile?true:undefined} role={small&&mobile?'dialog':undefined} aria-modal={small&&mobile?true:undefined} aria-label={t('menu')}>
      <div className="sidebar-brand"><Link to="/" aria-label="WeRide"><Brand/></Link><button type="button" className="icon-button mobile-close" onClick={()=>setMobile(false)} aria-label={t('close')}><X size={20}/></button></div>
      <div className="project-switch"><span className="project-letter">W</span><div><strong>WeRide Sweden</strong><small>{t('workspace')}</small></div></div>
      <div className="sidebar-navigation"><p className="nav-label">{t('project')}</p><nav aria-label={t('project')}>{nav.map(({to,label,icon:Icon})=><NavLink key={to} to={to} end={to==='/'} className={({isActive})=>`nav-item ${isActive?'active':''}`}><Icon size={19}/><span>{t(label)}</span>{label==='matrix'&&data&&<span className="nav-count">{data.requirements.length}</span>}{label==='qhMenu'&&data&&<span className="nav-count">{data.entries.filter(e=>e.kind==='qa').length}</span>}</NavLink>)}</nav></div>
      <div className="sidebar-bottom"><div className="team-note"><ShieldCheck size={20}/><strong>{t('internal')}</strong><p>@madison.dev</p><span>{t('partner')}</span></div><div className="profile"><span className="avatar">{(member?.name||'M').split(' ').slice(0,2).map(v=>v[0]).join('').toUpperCase()}</span><div><strong>{member?.name}</strong><small>{member?.email}</small></div><button className="icon-button" type="button" onClick={()=>void logout()} title={t('signOut')} aria-label={t('signOut')}><LogOut size={18}/></button></div><div className="madison-wordmark">madison<span>technologies</span></div></div>
    </aside>
    <div className="main-column" inert={small&&mobile}>
      <header className="topbar"><button ref={menuButton} type="button" className="icon-button mobile-menu" onClick={()=>setMobile(true)} aria-label={t('menu')} aria-expanded={mobile} aria-controls="workspace-navigation"><Menu size={22}/></button><div className="breadcrumb"><span>WeRide</span><ChevronRight size={13}/><strong>{t(section)}</strong></div>
        <form className="global-search" role="search" onSubmit={e=>{e.preventDefault();navigate(`/search?q=${encodeURIComponent(search)}`);}}><Search size={18}/><input aria-label={t('uxSearch')} placeholder={t('uxSearchHint')} value={search} onChange={e=>setSearch(e.target.value)}/><button type="submit" className="icon-button" aria-label={t('uxSearch')}><ArrowUpRight size={16}/></button></form><LocaleSwitch/>
        <span className={`connection ${!online?'connection-offline':''}`} role="status" title={lastSyncedAt?t('uxLastSync',{time:new Date(lastSyncedAt).toLocaleString()}):undefined}><i/>{t(syncStatus)}</span>
      </header>
      {data&&<div className="workspace-utilities"><DraftShelf/><label className="density-control"><span>{t('uxDensity')}</span><select aria-label={t('uxDensity')} value={density} onChange={e=>setDensity(e.target.value as Density)}><option value="comfortable">{t('uxComfortable')}</option><option value="compact">{t('uxCompact')}</option></select></label></div>}
      {preview&&<div className="preview-bar"><CircleHelp size={15}/>{t('previewNotice')}</div>}
      {persistenceLimited&&!preview&&<div className="session-storage-notice" role="status">{t('sessionStorageLimited')}</div>}
      {!online&&!preview&&<div className="error-banner" role="alert">{t('offline')}</div>}
      {error&&data&&<div className="error-banner" role="alert">{t('uxSyncError')}<button className="button secondary small" onClick={retry}>{t('retry')}</button></div>}
      {authError&&<p className="error-banner" role="alert">{t(authError)}</p>}
      {!preview&&minutes!==null&&minutes<=10&&<div className="session-warning" role="status"><span>{t('uxSessionWarning',{minutes})}</span><button className="button secondary small" disabled={renewing} onClick={async()=>{setRenewing(true);try{await renewSession();}finally{setRenewing(false);}}}>{t('uxRenew')}</button></div>}
      <main id="main" tabIndex={-1} className="main-content">{loading&&!data?<Spinner/>:error&&!data?<div className="error-state" role="alert"><CircleHelp size={34}/><h1>{t(error)}</h1><button className="button primary" onClick={retry}>{t('retry')}</button></div>:data?<Outlet/>:null}</main>
      {data&&<RouteEffects/>}
      <footer className="app-footer"><span>WeRide · {t('workspace')}</span><Link to="/sources">{data?.project.reference||'Madison Technologies'}<ArrowUpRight size={13}/></Link></footer>
    </div>
  </div>;
}
