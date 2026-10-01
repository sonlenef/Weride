import {useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {ArrowUpRight,History,RotateCcw,Search,Trash2} from 'lucide-react';
import {useWorkspace} from '../lib/store';
import {useAuth} from '../lib/auth';
import {formatDate,text} from '../lib/i18n';
import {activityTarget} from '../lib/question-hub';
import {canManageEntry} from '../lib/questions';
import {canRestorePrevious,fieldChanges} from '../lib/history';
import type {Activity,TrashItem} from '../lib/types';
import {Badge,Modal,useToast} from '../components/ui';
import {readableError} from '../components/Editors';
export default function ActivityPage(){
  const {data,online,hasOlderActivities,loadOlderActivities,restoreTrash,restorePrevious}=useWorkspace();
  const {member,preview}=useAuth(),{t,i18n}=useTranslation(),toast=useToast(),[params,setParams]=useSearchParams();
  const [selected,setSelected]=useState<Activity|null>(null),[restore,setRestore]=useState<TrashItem|Activity|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const query=params.get('q')||'',tab=params.get('view')==='trash'?'trash':'history',d=data!;
  const events=d.activities.filter(e=>[e.requirementId,e.actorName,...Object.values(e.title)].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const archived=(d.trash||[]).filter(x=>!x.restoredBy&&[x.entryId,...Object.values(x.snapshot.title)].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt));
  const change=(key:string,value:string)=>{const next=new URLSearchParams(window.location.search);value?next.set(key,value):next.delete(key);setParams(next,{replace:true});};
  const apply=async()=>{if(!restore)return;setBusy(true);setError('');try{if('snapshot' in restore)await restoreTrash(restore);else await restorePrevious(restore);setRestore(null);setSelected(null);toast(t('uxRestored'));}catch(e){setError(readableError(e));}finally{setBusy(false);}};
  const target=(e:Activity)=>e.kind==='reply'?`/questions?question=${encodeURIComponent(String((e.after as {questionId?:string}|null)?.questionId||(e.before as {questionId?:string}|null)?.questionId||''))}`:activityTarget(e);
  return <div className="page-enter"><div className="page-heading"><div><span className="eyebrow">WERIDE / {t('activity')}</span><h1>{t('activityTitle')}</h1><p>{t('uxHistoryHint')}</p></div><Badge>{d.activities.length}</Badge></div>
    <div className="activity-tools"><button className="button secondary" aria-pressed={tab==='history'} onClick={()=>change('view','')}><History size={16}/>{t('activity')}</button><button className="button secondary" aria-pressed={tab==='trash'} onClick={()=>change('view','trash')}><Trash2 size={16}/>{t('uxTrash')} · {archived.length}</button></div>
    <section className="panel"><label className="search-field activity-search"><Search size={17}/><input value={query} onChange={e=>change('q',e.target.value)} placeholder={t('search')} aria-label={t('searchLabel')}/></label>
      {tab==='history'?<>{events.map(e=><article key={e.id} className="activity-event"><span className="avatar">{e.actorName.split(' ').slice(0,2).map(w=>w[0]).join('')}</span><div className="activity-event-body"><div><strong>{e.actorName}</strong><span>{t(e.action==='delete'?'deletedAction':e.action==='restore'?'uxRestored':e.action==='resolve'?'uxAccepted':e.action)}</span><time>{formatDate(e.at,i18n.language,true)}</time></div><p>{e.kind==='review'?t('vendorReview'):text(e.title,i18n.language)}</p><footer><Link to={target(e)}>{e.requirementId||t('qhGeneral')}<ArrowUpRight size={13}/></Link><button onClick={()=>setSelected(e)}>{t('inspect')}</button></footer></div></article>)}
        {!events.length&&<div className="empty-state"><History size={32}/><p>{t(query?'qhNoResults':'noActivity')}</p></div>}
        {hasOlderActivities&&<button className="button secondary" disabled={busy||(!online&&!preview)} onClick={async()=>{setBusy(true);try{await loadOlderActivities();}catch(e){setError(readableError(e));}finally{setBusy(false);}}}>{t(busy?'loading':'uxOlder')}</button>}
      </>:<><p className="small-note">{t('uxRestoreHelp')}</p>{archived.map(item=><article className="trash-card" key={item.id}><header><strong>{text(item.snapshot.title,i18n.language)}</strong>{canManageEntry(item.snapshot,member?.uid)&&<button className="button secondary small" disabled={busy||(!online&&!preview)} onClick={()=>setRestore(item)}><RotateCcw size={15}/>{t('uxRestore')}</button>}</header><p>{item.snapshot.requirementId||t('qhGeneral')} · {t(item.snapshot.kind)}</p><small>{item.deletedByName} · {formatDate(item.deletedAt,i18n.language,true)}</small></article>)}{!archived.length&&<p className="empty-state">{t('emptyItems')}</p>}</>}
      {error&&!restore&&<p className="error-banner" role="alert">{t(error)}</p>}
    </section>
    {selected&&!restore&&<Modal title={`${t('inspect')} · ${selected.requirementId||t('qhGeneral')}`} onClose={()=>setSelected(null)} wide><div className="modal-body history-detail"><p><strong>{selected.actorName}</strong> · {formatDate(selected.at,i18n.language,true)}</p>
      <Diff before={selected.before} after={selected.after}/><details className="editor-advanced"><summary>{t('uxRaw')}</summary><h3>{t('before')}</h3><pre>{JSON.stringify(selected.before,null,2)}</pre><h3>{t('after')}</h3><pre>{JSON.stringify(selected.after,null,2)}</pre></details>
      {canRestorePrevious(selected,d,member?.uid)&&<><p className="small-note">{t('uxRestoreVersion')}</p><button className="button secondary" disabled={!online&&!preview} onClick={()=>setRestore(selected)}><RotateCcw size={16}/>{t('uxRestorePrevious')}</button></>}
    </div></Modal>}
    {restore&&<Modal title={t('uxRestoreConfirm')} onClose={()=>{if(!busy)setRestore(null);}} wide><div className="modal-body"><p>{t('uxRestoreHelp')}</p><Diff before={'snapshot' in restore?null:restore.after} after={'snapshot' in restore?restore.snapshot:restore.before}/>{error&&<p className="error-banner" role="alert">{t(error)}</p>}</div><footer className="modal-footer"><button className="button secondary" disabled={busy} data-autofocus onClick={()=>setRestore(null)}>{t('cancel')}</button><button className="button primary" disabled={busy} onClick={()=>void apply()}>{t(busy?'saving':'uxRestore')}</button></footer></Modal>}
  </div>;
}
function Diff({before,after}:{before:unknown;after:unknown}){
  const {t}=useTranslation(),rows=fieldChanges(before,after);
  const names:Record<string,string>={requirementId:'qhScope',body:'details',title:'title',answer:'answer',acceptance:'acceptance',priority:'priority',status:'status',state:'reviewStatus',owner:'owner',ownerUid:'uxDecisionOwner',requirementIds:'uxDecisionRelated',source:'uxDecisionSource',originalLocale:'uxSourceLanguage',compliance:'compliance',comments:'comment',effortHours:'hours',estimateHours:'hours',cost:'cost',currency:'currency',releaseDate:'releaseDate',assigneeUid:'picColumn',replyId:'uxAccepted'};
  return rows.length?<div className="diff-scroll"><table className="diff-table"><thead><tr><th>{t('uxField')}</th><th>{t('before')}</th><th>{t('after')}</th></tr></thead><tbody>{rows.map(r=><tr key={r.field}><th scope="row">{r.field.split('.').map((part,index)=>index===0?t(names[part]||part):part.toUpperCase()).join(' · ')}</th><td>{r.before||'—'}</td><td>{r.after||'—'}</td></tr>)}</tbody></table></div>:<p className="small-note">{t('uxNoDiff')}</p>;
}
