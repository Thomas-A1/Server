// const fs = require('fs');
// const path = require('path');
// const admin = require("firebase-admin");
// const dotenv = require("dotenv");

// // Explicitly specify the path to the .env file
// const envPath = path.resolve(__dirname, '/Users/macpro/Desktop/UniGhanaBackend/.env');

// // Load environment variables with an explicit path
// dotenv.config({ path: envPath });


// // Safely parse the service account key
// let serviceAccountKey;
// try {
//     serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
// } catch (error) {
//     console.error('Error parsing Firebase service account key:', error);
//     throw new Error('Invalid Firebase service account key');
// }

// // Initialize Firebase Admin SDK
// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccountKey),
//     storageBucket: process.env.FIREBASE_STORAGE_BUCKET
// });

// const db = admin.firestore();
// const auth = admin.auth();
// const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);


// module.exports = { db, auth, admin, bucket };


const admin = require("firebase-admin");
const dotenv = require("dotenv");

dotenv.config(); // Only needed for local dev

// Decode base64 service account key
const base64Key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;
const decodedKey = Buffer.from(base64Key, 'base64').toString('utf-8');

let serviceAccountKey;
try {
    serviceAccountKey = JSON.parse(decodedKey);
} catch (error) {
    console.error('Error parsing Firebase service account key:', error);
    throw new Error('Invalid Firebase service account key');
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);

module.exports = { db, auth, admin, bucket };
