import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "AIzaSyBmGSl2VX-MEHVKPznjf4mS2HiR5dfQFTw",
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "idcs-system.firebaseapp.com",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "idcs-system",
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "idcs-system.firebasestorage.app",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "468784770757",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || "1:468784770757:web:a7f59474c959668ef00aac",
  measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || "G-0XYZ0D8J84"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Analytics conditionally
export let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch((err) => {
    console.warn("Firebase Analytics could not be initialized:", err);
  });
}

export { firebaseConfig };
export default app;
