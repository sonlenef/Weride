import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {FilePenLine,Trash2} from 'lucide-react';
import {useAuth} from '../lib/auth';
import {listDrafts,removeDraft} from '../lib/draft-storage';
import type {DraftRecord} from '../lib/draft-storage';
import type {Entry,Review,Reply,Decision} from '../lib/types';
import {Modal} from './ui';
import {EntryEditor,ReviewEditor} from './Editors';
import {ReplyEditor} from './ReplyThread';
import {DecisionEditor} from './DecisionRegister';
export default function DraftShelf(){
  const {member}=useAuth(),{t}=useTranslation(),uid=member?.uid||'';
  const [items,setItems]=useState<DraftRecord[]>(()=>listDrafts(uid)),[open,setOpen]=useState(false),[selected,setSelected]=useState<DraftRecord|null>(null);
  useEffect(()=>{const refresh=()=>setItems(listDrafts(uid));window.addEventListener('weride:drafts',refresh);const timer=setInterval(refresh,60000);refresh();return()=>{clearInterval(timer);window.removeEventListener('weride:drafts',refresh);};},[uid]);
  return <><button className="button secondary small drafts-trigger" type="button" onClick={()=>setOpen(true)}><FilePenLine size={16}/>{t('uxDrafts')} <span>{items.length}</span></button>
    {open&&<Modal title={t('uxDrafts')} onClose={()=>setOpen(false)} wide><div className="modal-body"><p>{t('uxDraftPolicy')}</p><p className="small-note">{t('uxDraftShelfHint')}</p>{!items.length&&<p>{t('uxNoDrafts')}</p>}{items.map(item=><article className="draft-row" key={item.key}><div><strong>{item.label}</strong><small>{item.type} · {new Date(item.updatedAt).toLocaleString()}</small></div><button className="button primary small" onClick={()=>{setSelected(item);setOpen(false);}}>{t('uxResume')}</button><button className="icon-button" aria-label={`${t('uxDiscard')} ${item.label}`} onClick={()=>{if(window.confirm(t('unsaved')))removeDraft(uid,item.key);}}><Trash2 size={16}/></button></article>)}</div></Modal>}
    {selected?.type==='entry'&&<EntryEditor initial={selected.value as Entry} draftKey={selected.key} allowQuestionScope onClose={()=>setSelected(null)}/>}
    {selected?.type==='review'&&<ReviewEditor initial={selected.value as Review} draftKey={selected.key} onClose={()=>setSelected(null)}/>}
    {selected?.type==='reply'&&<ReplyEditor initial={selected.value as Reply} draftKey={selected.key} onClose={()=>setSelected(null)}/>}
    {selected?.type==='decision'&&<DecisionEditor initial={selected.value as Decision} draftKey={selected.key} onClose={()=>setSelected(null)}/>}
  </>;
}
