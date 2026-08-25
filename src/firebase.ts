import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, GoogleAuthProvider, OAuthProvider, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('EducationRev could not enable local auth persistence:', error);
});
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId === 'default' ? undefined : firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});
export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');
export const microsoftProvider = new OAuthProvider('microsoft.com');
export const microsoftTenantId = '665cc3da-a0bd-4a2b-b13d-a672538b0a70';
microsoftProvider.setCustomParameters({
  prompt: 'select_account',
  tenant: 'common',
});
