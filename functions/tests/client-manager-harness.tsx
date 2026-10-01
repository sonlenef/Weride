// Used only by the loopback Playwright harness. Not part of the production entry graph.
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import '../../src/lib/i18n';
import '../../src/styles.css';
import '../../src/design-system.css';
import ClientQuestions from '../../src/pages/ClientQuestions';
import {ToastProvider} from '../../src/components/ui';
createRoot(document.getElementById('root')!).render(<BrowserRouter><ToastProvider><main className="main-content"><ClientQuestions/></main></ToastProvider></BrowserRouter>);
