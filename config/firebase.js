import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { firebaseConfig } from './firebase-config';

// Cloud Functions can be restored if the project returns to a trusted backend:
// import { getFunctions } from 'firebase/functions';

const app = getApps().length > 0
  ? getApp()
  : initializeApp(firebaseConfig);

export const db = getFirestore(app);
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
