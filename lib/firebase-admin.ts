import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getPrivateKey(): string {
  const raw = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
  // Vercel stores multiline values with literal \n — convert to real newlines
  return raw.replace(/\\n/g, '\n');
}

const adminApp =
  getApps().find((a) => a.name === 'admin') ||
  initializeApp(
    {
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: getPrivateKey(),
      }),
    },
    'admin'
  );

export const adminDb = getFirestore(adminApp);
