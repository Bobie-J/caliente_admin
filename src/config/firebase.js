// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebaseコンソールで取得した設定情報を記述します
const firebaseConfig = {
  apiKey: "AIzaSyCuHfH2TwfaXe1hoarEM2rlz_XSU60cPk0",
  authDomain: "zumba-fc.firebaseapp.com",
  projectId: "zumba-fc",
  storageBucket: "zumba-fc.firebasestorage.app",
  messagingSenderId: "262704243243",
  appId: "1:262704243243:web:f912a8779e0877f37e806e",
  measurementId: "G-VZY88CH467"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);