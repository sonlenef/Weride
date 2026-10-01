import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {readScroll,rememberScroll} from '../lib/preferences';
export default function RouteEffects(){
  const location=useLocation(),{t}=useTranslation();
  useEffect(()=>{
    const url=location.pathname+location.search,save=()=>rememberScroll(url);
    window.addEventListener('scroll',save,{passive:true});return()=>{window.removeEventListener('scroll',save);};
  },[location.pathname,location.search]);
  useEffect(()=>{
    const key:Record<string,string>={'/':'overview','/requirements':'matrix','/questions':'qhMenu','/system':'system','/sources':'sourceNotes','/review-packs':'aiPacks','/activity':'activity','/search':'uxSearchResults','/client-questions':'cqMenu'};
    const section=key[location.pathname];document.title=`${section?t(section):location.pathname.split('/').at(-1)} · WeRide`;
    let applied=false;
    const apply=()=>{
      if(applied||document.querySelector('dialog[open]'))return;
      let hash=location.hash.slice(1);try{hash=decodeURIComponent(hash);}catch{/* Keep malformed fragments inert. */}
      const target=location.hash?document.getElementById(hash):document.querySelector<HTMLElement>('#main h1');
      if(!target)return;applied=true;target.tabIndex=-1;target.focus({preventScroll:true});
      if(location.state?.restore){const y=readScroll(location.pathname+location.search);window.scrollTo({top:y,behavior:'instant'});}
      else if(location.hash)target.scrollIntoView({block:'start',behavior:'instant'});
      else window.scrollTo({top:0,behavior:'instant'});
    };
    const observer=new MutationObserver(apply);observer.observe(document.getElementById('main')||document.body,{subtree:true,childList:true});
    const frame=requestAnimationFrame(apply);return()=>{cancelAnimationFrame(frame);observer.disconnect();};
  },[location.pathname,location.hash,t]);
  return null;
}
