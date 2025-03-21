import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: "chargingitadmin.firebaseapp.com",
  projectId: "chargingitadmin",
  storageBucket: "chargingitadmin.appspot.com",
  messagingSenderId: "225849904251",
  appId: "1:225849904251:web:61870f8332f8a86578e6de",
  measurementId: "G-E9WLF8H46G",
};

const app = initializeApp(firebaseConfig, "auth-app");
export const auth = getAuth(app);
