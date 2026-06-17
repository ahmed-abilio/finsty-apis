import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import 'dotenv/config';

const {
  FIREBASE_SERVICE_ACCOUNT_PATH,
  FIREBASE_SERVICE_ACCOUNT_JSON,
  FIREBASE_PROJECT_ID,
} = process.env;

function initializeFirebase(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }

  let credential: admin.credential.Credential;

  if (FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON) as admin.ServiceAccount;
    credential = admin.credential.cert(serviceAccount);
  } else if (FIREBASE_SERVICE_ACCOUNT_PATH) {
    const raw = readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8');
    const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
    credential = admin.credential.cert(serviceAccount);
  } else {
    // Fallback: Application Default Credentials (for GCP environments)
    credential = admin.credential.applicationDefault();
  }

  return admin.initializeApp({
    credential,
    projectId: FIREBASE_PROJECT_ID,
  });
}

const firebaseApp = initializeFirebase();

export const firebaseAuth = firebaseApp.auth();
export const firebaseMessaging = admin.messaging();
export default firebaseApp;
