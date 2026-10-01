import express from 'express';
import {createQuestionnaireApp} from './questionnaire-api.js';
import {QuestionnaireRepository} from './questionnaire-repository.js';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { createSharingApp } from './sharing.js';
import { FirestoreShareRepository, loadWorkspace } from './repository.js';
initializeApp();
const db=getFirestore();
const sharingApp=createSharingApp({
  verifyToken:token=>getAuth().verifyIdToken(token,true),
  loadWorkspace:()=>loadWorkspace(db),repository:new FirestoreShareRepository(db),
  publicOrigin:'https://weride-discovery.web.app',
  allowedOrigins:['https://weride-discovery.web.app','https://weride-discovery.firebaseapp.com',...(process.env.FUNCTIONS_EMULATOR==='true'?['http://127.0.0.1:5173','http://127.0.0.1:5000']:[])],
});
const app=express();
app.use('/api/client-questionnaires',createQuestionnaireApp({
  repository:new QuestionnaireRepository(db,'https://weride-discovery.web.app'),
  verifyToken:token=>getAuth().verifyIdToken(token,true),
  allowedOrigins:['https://weride-discovery.web.app','https://weride-discovery.firebaseapp.com',...(process.env.FUNCTIONS_EMULATOR==='true'?['http://127.0.0.1:5173','http://127.0.0.1:5000']:[])],
}));
app.use(sharingApp);
export const reviewSharing=onRequest({region:'europe-west1',serviceAccount:'weride-review-sharing@weride-discovery.iam.gserviceaccount.com',memory:'256MiB',timeoutSeconds:30,minInstances:0,maxInstances:2,cpu:1,concurrency:20,invoker:'public',cors:false},app);
