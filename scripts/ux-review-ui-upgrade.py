from pathlib import Path
p=Path('src/pages/ReviewPacks.tsx');s=p.read_text()
s=s.replace('reviewErrorKey, sharingAvailable','reviewErrorKey, sharingState')
s=s.replace("const [tab,setTab]=useState<'prepare'|'links'>('prepare'),[ready,setReady]=useState<boolean|null>(null);", "const [tab,setTab]=useState<'prepare'|'links'>('prepare'),[ready,setReady]=useState<boolean|null>(null);\n  const [serviceState,setServiceState]=useState('checking'),[healthAttempt,setHealthAttempt]=useState(0);")
s=s.replace("  useEffect(()=>{const controller=new AbortController();if(preview){setReady(false);return;}void sharingAvailable(controller.signal).then(v=>{if(!controller.signal.aborted)setReady(v);});return()=>controller.abort();},[preview]);", """  useEffect(()=>{const controller=new AbortController();if(preview){setReady(false);return;}
    setReady(null);setServiceState('checking');void sharingState(controller.signal).then(v=>{if(!controller.signal.aborted){setReady(v==='available');setServiceState(v);}});return()=>controller.abort();
  },[preview,online,healthAttempt]);
  const serviceMessage=serviceState==='offline'?'uxSharingOffline':serviceState==='unauthorized'?'uxSharingAuth':serviceState==='checking'?'uxChecking':'uxSharingUnavailable';
  const serviceNotice=<div className="ai-checking-state" role="status"><p>{t(preview?'aiLocalOnly':serviceMessage)}</p>{!preview&&<button className="button secondary small" disabled={ready===null} onClick={()=>setHealthAttempt(n=>n+1)}>{t('retry')}</button>}</div>;""")
s=s.replace("  const selectableItems=d.entries.filter(e=>selectedIds.has(e.requirementId));", """  const selectableItems=d.entries.filter(e=>(selectedIds.has(e.requirementId)||(options.includeGeneralQa&&e.kind==='qa'&&e.requirementId===''))&&(e.kind==='qa'?options.includeQa:e.kind==='breakdown'?options.includeBreakdown:options.includeAssumptions));
  const selectedItemCount=selectableItems.filter(e=>!options.excludedEntryIds.includes(e.id)).length;
  const eligibleDecisions=(d.decisions||[]).filter(x=>!x.requirementIds.length||x.requirementIds.some(id=>selectedIds.has(id)));""")
s=s.replace("const change=(patch:Partial<PackOptions>)=>setOptions(o=>({...o,...patch}));", "const change=(patch:Partial<PackOptions>)=>setOptions(o=>({...o,...patch,...(patch.includeGeneralQa===true?{includeQa:true}:{}),...(patch.includeQa===false?{includeGeneralQa:false}:{})}));")
s=s.replace('scope,excludedEntryIds:[]','scope,excludedEntryIds:[],excludedDecisionIds:[]')
s=s.replace('selectableItems.length-options.excludedEntryIds.length','selectedItemCount')
s=s.replace("{t('aiExclude')} <Badge>{selectedItemCount}/{selectableItems.length}</Badge>","{t('aiExclude')} <Badge>{selectedItemCount}/{selectableItems.length}</Badge>")
old="{preview||ready===false?<p className=\"ai-service-notice\" role=\"status\">{t(preview?'aiLocalOnly':'aiSharingPending')}</p>:ready===null?<p role=\"status\">{t('aiChecking')}</p>:<>"
s=s.replace(old,"{preview||ready!==true?serviceNotice:<>")
s=s.replace("{!ready||preview?<p className=\"ai-service-notice\">{t(preview?'aiLocalOnly':ready===null?'aiChecking':'aiSharingPending')}</p>:<>","{!ready||preview?serviceNotice:<>")
extra='''        <div className="ai-option-group"><h3>{t('uxGeneralContext')}</h3><label className="ai-check"><input type="checkbox" checked={options.includeGeneralQa} onChange={e=>change({includeGeneralQa:e.target.checked})}/><span>{t('uxGeneralContext')}</span></label><label className="ai-check"><input type="checkbox" checked={options.includeDecisions} onChange={e=>change({includeDecisions:e.target.checked})}/><span>{t('uxDecisionContext')}</span></label><small>{t('uxContextWarning')}</small></div>
        {options.includeDecisions&&<details className="ai-details"><summary>{t('uxDecisions')} <Badge>{eligibleDecisions.filter(x=>!options.excludedDecisionIds.includes(x.id)).length}/{eligibleDecisions.length}</Badge></summary><div className="ai-item-picker">{eligibleDecisions.map(x=><label className="ai-check" key={x.id}><input type="checkbox" checked={!options.excludedDecisionIds.includes(x.id)} onChange={e=>change({excludedDecisionIds:e.target.checked?options.excludedDecisionIds.filter(id=>id!==x.id):[...options.excludedDecisionIds,x.id]})}/><span><strong>{x.id} · {t(x.state==='proposed'?'uxProposed':x.state==='superseded'?'uxSuperseded':x.state)}</strong><small>{text(x.title,i18n.language)}</small></span></label>)}</div></details>}
'''
s=s.replace("        {options.scope.kind==='requirement'&&",extra+"        {options.scope.kind==='requirement'&&")
s=s.replace("<strong>{e.id} · {t(e.kind)}</strong>", "<strong>{e.id} · {e.requirementId||t('qhGeneral')} · {t(e.kind)}</strong>")
s=s.replace("<p className=\"ai-caption\">{t('aiFrozen')}</p>", "<p className=\"ai-caption\">{t('aiFrozen')}</p><p className=\"ai-caption\" role=\"status\">{t('uxEnabledItems',{selected:selectedItemCount,eligible:selectableItems.length})}{pack&&` · ${t('uxDecisions')}: ${pack.content.coverage.decisionsIncluded||0} · ${t('uxReplies')}: ${(pack.content.replies||[]).length}`}</p>")
p.write_text(s)
print('Sharing controls now display effective selection counts, opt-in project context, decision exclusions, and retryable service states.')
