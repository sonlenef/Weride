export interface SyncInputs {preview:boolean;online:boolean;error:boolean;writeFault:boolean;pending:boolean;serverReady:boolean;}
export function syncState(s:SyncInputs):string {
  if(s.preview)return 'preview';
  if(!s.online)return 'offline';
  if(s.error)return 'uxSyncError';
  if(s.writeFault)return 'uxWriteError';
  if(s.pending)return 'saving';
  return s.serverReady?'uxSynced':'uxSyncing';
}
