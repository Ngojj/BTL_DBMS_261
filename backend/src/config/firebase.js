import admin from 'firebase-admin';
import { env } from './env.js';

// Dev: FIRESTORE_EMULATOR_HOST được set → Admin SDK tự nối Emulator, không cần serviceAccount.
// Firebase thật: đặt GOOGLE_APPLICATION_CREDENTIALS trỏ tới serviceAccount.json (KHÔNG commit).
if (!admin.apps.length) {
  admin.initializeApp({ projectId: env.firebaseProjectId });
}

export const firestore = admin.firestore();
export const firebaseAuth = () => admin.auth();
