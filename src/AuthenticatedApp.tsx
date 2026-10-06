import {lazy,Suspense} from 'react';
import type {ReactNode} from 'react';
import {BrowserRouter,Navigate,Route,Routes} from 'react-router-dom';
import {WorkspaceProvider} from './lib/store';
import {Spinner} from './components/ui';
import Shell from './components/Shell';
const Overview=lazy(()=>import('./pages/Overview'));
const Matrix=lazy(()=>import('./pages/Matrix'));
const Requirement=lazy(()=>import('./pages/Requirement'));
const Questions=lazy(()=>import('./pages/Questions'));
const System=lazy(()=>import('./pages/System'));
const ActorMap=lazy(()=>import('./pages/ActorMap'));
const ProductTree=lazy(()=>import('./pages/ProductTree'));
const ProductModule=lazy(()=>import('./pages/ProductModule'));
const Sources=lazy(()=>import('./pages/Sources'));
const Activity=lazy(()=>import('./pages/Activity'));
const ReviewPacks=lazy(()=>import('./pages/ReviewPacks'));
const ClientQuestions=lazy(()=>import('./pages/ClientQuestions'));
const Search=lazy(()=>import('./pages/Search'));
export default function AuthenticatedApp(){
  const view=(page:ReactNode)=><Suspense fallback={<Spinner/>}>{page}</Suspense>;
  return <WorkspaceProvider><BrowserRouter><Routes><Route element={<Shell/>}>
    <Route index element={view(<Overview/>)}/><Route path="requirements" element={view(<Matrix/>)}/>
    <Route path="requirements/:id" element={view(<Requirement/>)}/><Route path="questions" element={view(<Questions/>)}/>
    <Route path="system" element={view(<System/>)}/><Route path="actors" element={view(<ActorMap/>)}/><Route path="product-tree" element={view(<ProductTree/>)}/><Route path="product-tree/:id" element={view(<ProductModule/>)}/><Route path="sources" element={view(<Sources/>)}/>
    <Route path="activity" element={view(<Activity/>)}/><Route path="review-packs" element={view(<ReviewPacks/>)}/>
    <Route path="client-questions" element={view(<ClientQuestions/>)}/><Route path="search" element={view(<Search/>)}/><Route path="*" element={<Navigate to="/" replace/>}/>
  </Route></Routes></BrowserRouter></WorkspaceProvider>;
}
