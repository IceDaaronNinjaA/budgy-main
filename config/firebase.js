import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { firebaseConfig } from './firebase-config';

// Cloud Functions can be restored if the project returns to a trusted backend:
// import { getFunctions } from 'firebase/functions';

const app = getApps().length > 0
  ? getApp()
  : initializeApp(firebaseConfig);

// React Native cannot keep Firestore's default WebChannel stream open, which
// surfaces as "client is offline"; long polling works on iOS and Android.
export const db = Platform.OS === 'web'
  ? getFirestore(app)
  : (() => {
    try {
      return initializeFirestore(app, { experimentalForceLongPolling: true });
    } catch {
      return getFirestore(app);
    }
  })();
export const auth = Platform.OS === 'web'
  ? getAuth(app)
  : (() => {
    try {
      return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      return getAuth(app);
    }
  })();
// export const functions = getFunctions(app, 'us-central1');

export default app;
