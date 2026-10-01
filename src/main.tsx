import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './lib/i18n';
const App=lazy(()=>location.pathname.startsWith('/respond/')?import('./pages/ClientRespond'):import('./App'));

import './styles.css';
import './design-system.css';
createRoot(document.getElementById('root')!).render(<StrictMode><Suspense fallback={<div className="loading-state" role="status">WeRide · Loading…</div>}><App/></Suspense></StrictMode>);
