import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// chadream2 프로젝트 (Firebase 콘솔 웹앱 설정과 동일하게 유지)
const firebaseConfig = {
  apiKey: "AIzaSyAaEH5pqUgQMp-CtIFCBsAyncsy6LPIILQ",
  authDomain: "chadream2.firebaseapp.com",
  projectId: "chadream2",
  storageBucket: "chadream2.firebasestorage.app",
  messagingSenderId: "669170323240",
  appId: "1:669170323240:web:f1ccea30beca3bc4744a1d",
  measurementId: "G-W5LE32L57M"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); 