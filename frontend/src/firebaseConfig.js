// frontend/src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// Import other Firebase services like Firestore if needed later
// import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// Replace with your actual config values from the Firebase console
const firebaseConfig = {
    apiKey: "AIzaSyDACJEwJD-Z1ONK1SYKaPRJEAtlKZSzGow",
    authDomain: "nyc-transit-hub.firebaseapp.com",
    projectId: "nyc-transit-hub",
    storageBucket: "nyc-transit-hub.firebasestorage.app",
    messagingSenderId: "162197936023",
    appId: "1:162197936023:web:3d7d0fc7ecb8ddc90d56d2",
    measurementId: "G-CCZ37BEYLL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

// Initialize other services if needed (e.g., Firestore)
// const db = getFirestore(app);

// Export the auth instance (and other services) to be used elsewhere
export { auth }; //, db }; // Uncomment db if you initialize Firestore