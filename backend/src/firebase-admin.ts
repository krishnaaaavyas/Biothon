import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isConfigured = false;
let db: any = null;

const serviceAccountPath = path.resolve(__dirname, "../service-account.json");
const hasServiceAccount = fs.existsSync(serviceAccountPath);
const hasServiceAccountEnv = !!process.env.FIREBASE_SERVICE_ACCOUNT;
const hasEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const hasGac = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

const canRunRealFirebase = hasServiceAccount || hasServiceAccountEnv || hasEmulator || hasGac;

try {
  if (canRunRealFirebase) {
    if (hasServiceAccount) {
      const raw = fs.readFileSync(serviceAccountPath, "utf8");
      const serviceAccount = JSON.parse(raw);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("Firebase Admin initialized via service-account.json");
    } else if (hasServiceAccountEnv) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("Firebase Admin initialized via FIREBASE_SERVICE_ACCOUNT env var");
    } else {
      admin.initializeApp();
      console.log("Firebase Admin initialized via default credentials or emulator");
    }
    db = admin.firestore();
    isConfigured = true;
  } else {
    console.warn("No Firebase credentials or emulator found. Falling back to local mock storage mode.");
    isConfigured = false;
  }
} catch (err) {
  console.warn("Firebase Admin failed to initialize. Falling back to local mock storage mode.", err);
  isConfigured = false;
}

// Local Mock Storage for testing if Firebase Admin is unconfigured
class MockFirestore {
  private store: Record<string, any> = {};

  collection(name: string) {
    return {
      doc: (id: string) => {
        const key = `${name}/${id}`;
        return {
          get: async () => {
            const data = this.store[key];
            return {
              exists: data !== undefined,
              data: () => data
            };
          },
          set: async (data: any, options?: any) => {
            if (options?.merge && this.store[key]) {
              this.store[key] = { ...this.store[key], ...data };
            } else {
              this.store[key] = data;
            }
          },
          delete: async () => {
            delete this.store[key];
          }
        };
      }
    };
  }
}

if (!isConfigured || !db) {
  db = new MockFirestore();
}

export { admin, db, isConfigured };
