import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId === 'default' ? undefined : firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});
export const microsoftProvider = new OAuthProvider('microsoft.com');
export const microsoftTenantId = '665cc3da-a0bd-4a2b-b13d-a672538b0a70';
microsoftProvider.setCustomParameters({
  prompt: 'select_account',
  tenant: 'common',
});
