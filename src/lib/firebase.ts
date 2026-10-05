// src/lib/firebase.ts
//
// נקודת האתחול היחידה. שום רכיב אינו קורא ל-initializeApp.

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

// ⚠️ נפילה מוקדמת ומפורשת. בלי זה Firebase נכשל אחר כך בהודעה שאינה אומרת
// שחסר קובץ env, ומי שמריץ את זה בפעם הראשונה מחפש במקום הלא נכון.
const missing = required.filter((key) => !import.meta.env[key]);
if (missing.length > 0) {
  throw new Error(
    `חסרות הגדרות Firebase: ${missing.join(', ')}. ` +
      'העתק את .env.example ל-.env ומלא אותו מתוך הגדרות הפרויקט ב-Firebase.',
  );
}

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
