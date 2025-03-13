const admin = require("firebase-admin");
require("dotenv").config();


// Initialize Firebase Admin SDK
const serviceAccount = require("./serviceAccountKey.json"); // Ensure this file exists
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://chargingit-50971-default-rtdb.firebaseio.com/",
});

const db = admin.database();

// Define the data to insert
const newData = {
    bookingDetails: {
        message: "A slot is now available! hello",
        status: "pending",
        subject: "EV Charging Slot Available!",
        timestamp: new Date().toISOString(), // Current timestamp
        to: "m29k599471@gmail.com",
    },
};

// Insert into Firestore
async function insertNotification() {
    try {
        const docRef = await db.ref("emailNotifications").push(newData);
        console.log(`Document inserted successfully with ID: ${docRef.key}`);

    } catch (error) {
        console.error("Error inserting document:", error);
    }
}

insertNotification();