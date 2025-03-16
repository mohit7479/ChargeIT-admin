import { initializeApp } from "firebase/app";
import { getFirestore } from "@firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "0",
  authDomain: "chargingit-50971.firebaseapp.com",
  projectId: "chargingit-50971",
  storageBucket: "chargingit-50971.appspot.com",
  messagingSenderId: "625931027078",
  appId: "1:625931027078:web:a223e95a1aaa887ea58707",
  measurementId: "G-3HS707C9WV",
  databaseURL: "" // ✅ Corrected
};


const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const realtime = getDatabase(app);
export const auth = getAuth(app); 
