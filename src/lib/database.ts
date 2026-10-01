import { getFirestore } from 'firebase/firestore';
import { app } from './firebase';
// Loaded with the authenticated workspace; the login shell does not need Firestore.
export const db=app?getFirestore(app):null;
