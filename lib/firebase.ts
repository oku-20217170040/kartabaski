import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA1Rw2U8MsLea3YsNFEM7YKM4WXOcdUiCM",
  authDomain: "esenyurt-spot.firebaseapp.com",
  projectId: "esenyurt-spot",
  storageBucket: "esenyurt-spot.firebasestorage.app",
  messagingSenderId: "532173695068",
  appId: "1:532173695068:web:aaa60461f3248cb9ad9e99",
  measurementId: "G-8K57JCWTEK",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
