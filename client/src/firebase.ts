import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = { 
  apiKey : "AIzaSyD9DCPAogo6_ugGQlLg62SKwvOfGYXu2qc" , 
  authDomain : "specter-25052.firebaseapp.com" , 
  projectId : "specter-25052" , 
  storageBucket : "specter-25052.firebasestorage.app" , 
  messagingSenderId : "990390276624" , 
  appId : "1:990390276624:web:d7c9663325095e46a87095" , 
  measurementId : "G-YFLT0FDSES" 
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);