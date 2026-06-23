import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { environment } from '../../environments/environment';

const app = initializeApp(environment.firebase);

export const firebaseAuth = getAuth(app);
export const firestoreDb = getFirestore(app);
export const firebaseStorage = getStorage(app);
