// const admin = require("firebase-admin");
// const twilio = require("twilio");
// const nodemailer = require("nodemailer");
// require("dotenv").config();

// // Initialize Firebase Admin SDK
// const serviceAccount = require("./serviceAccountKey.json"); // Add Firebase Admin SDK Key
// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//     databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
// });

// const db = admin.firestore();

// // Twilio setup
// const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
// const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;  // Twilio Sender Number
// const USER_PHONE_NUMBER = "+919471945132"; // Always send SMS to this number

// // Nodemailer setup
// const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//         user: process.env.GMAIL_USER,
//         pass: process.env.GMAIL_PASS,
//     },
// });

// // Listen for new email notifications
// db.collection("emailNotifications")
//     .where("bookingDetails.status", "==", "pending") // Listen only for pending emails
//     .onSnapshot((snapshot) => {
//         snapshot.docChanges().forEach(async (change) => {
//             if (change.type === "added") {
//                 const data = change.doc.data().bookingDetails;
//                 console.log("New email notification detected:", data);

//                 // Send Email
//                 try {
//                     await transporter.sendMail({
//                         from: process.env.GMAIL_USER,
//                         to: data.to,
//                         subject: data.subject,
//                         text: data.message,
//                     });

//                     console.log(`✅ Email sent to ${data.to}`);

//                     // Send SMS notification
//                     try {
//                         await twilioClient.messages.create({
//                             body: `ALERT: ${data.message}`,
//                             from: TWILIO_PHONE_NUMBER,
//                             to: USER_PHONE_NUMBER, // Always sending to +9471945132
//                         });

//                         console.log(`📲 SMS sent to ${USER_PHONE_NUMBER}`);
//                     } catch (smsError) {
//                         console.error("❌ Error sending SMS:", smsError);
//                     }

//                     // Update the status to "sent" after sending the email
//                     await db.collection("emailNotifications").doc(change.doc.id).update({
//                         "bookingDetails.status": "sent",
//                     });

//                     console.log(`✅ Status updated to 'sent' for: ${change.doc.id}`);
//                 } catch (emailError) {
//                     console.error("❌ Error sending email:", emailError);
//                 }
//             }
//         });
//     });

// console.log("🔔 Listening for new email notifications...");

const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
require("dotenv").config();


if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require("./serviceAccountKey.json")),
        databaseURL: "https://chargingit-50971-default-rtdb.firebaseio.com/", // Replace with your Firebase Realtime DB URL
    });
}

// Firebase Realtime Database
const db = admin.database();

// Email and SMS configurations
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    },
});

const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const USER_PHONE_NUMBER = "+919471945132";

// Listen for new pending email notifications

db.ref("emailNotifications").once("value", (snapshot) => {
    // console.log(snapshot.val()); // Check if data exists
});

// db.ref("emailNotifications")
//     .orderByChild("status") // Now it works because "status" is at the top level
//     .equalTo("pending")
//     .on("child_added", async (snapshot) => {
//         console.log("📌 Change detected:", snapshot.key, snapshot.val());
//     });

db.ref("emailNotifications").orderByChild("status").equalTo("pending").on("child_added", async (snapshot) => {
    const data = snapshot.val();

    console.log("📌 New email notification detected:", data);

    // Send Email
    try {
        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: data.to,
            subject: data.subject,
            text: data.message,
        });

        console.log(`✅ Email sent to ${data.to}`);

        // Send SMS notification
        try {
            await twilioClient.messages.create({
                body: `ALERT: ${data.message}`,
                from: TWILIO_PHONE_NUMBER,
                to: USER_PHONE_NUMBER,
            });

            console.log(`📲 SMS sent to ${USER_PHONE_NUMBER}`);
        } catch (smsError) {
            console.error("❌ Error sending SMS:", smsError);
        }

        // Update status to "sent" in Firebase
        await db.ref(`emailNotifications/${snapshot.key}`).update({ status: "sent" });

        console.log(`✅ Status updated to 'sent' for: ${snapshot.key}`);
    } catch (emailError) {
        console.error("❌ Error sending email:", emailError);
    }
});


// db.ref("emailNotifications").orderByChild("bookingDetails/status").equalTo("pending").on("child_added", async (snapshot) => {
//     const data = snapshot.val().bookingDetails;
//     console.log("New email notification detected:", data);

//     // Send Email
//     try {
//         await transporter.sendMail({
//             from: process.env.GMAIL_USER,
//             to: data.to,
//             subject: data.subject,
//             text: data.message,
//         });

//         console.log(`✅ Email sent to ${data.to}`);

//         // Send SMS notification
//         try {
//             await twilioClient.messages.create({
//                 body: `ALERT: ${data.message}`,
//                 from: TWILIO_PHONE_NUMBER,
//                 to: USER_PHONE_NUMBER,
//             });

//             console.log(`📲 SMS sent to ${USER_PHONE_NUMBER}`);
//         } catch (smsError) {
//             console.error("❌ Error sending SMS:", smsError);
//         }

//         // Update the status to "sent" in the Realtime Database
//         await db.ref(`emailNotifications/${snapshot.key}/bookingDetails`).update({
//             status: "sent",
//         });

//         console.log(`✅ Status updated to 'sent' for: ${snapshot.key}`);
//     } catch (emailError) {
//         console.error("❌ Error sending email:", emailError);
//     }
// });

console.log("🔔 Listening for new email notifications...");


// const admin = require("firebase-admin");
// const twilio = require("twilio");
// const nodemailer = require("nodemailer");
// require("dotenv").config();

// // Initialize Firebase Admin SDK
// const serviceAccount = require("./serviceAccountKey.json"); // Add Firebase Admin SDK Key
// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//     databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
// });

// const db = admin.firestore();

// // Twilio setup
// const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// // Nodemailer setup
// const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//         user: process.env.GMAIL_USER,
//         pass: process.env.GMAIL_PASS,
//     },
// });

// // Listen for new email notifications
// db.collection("emailNotifications")
//     .where("bookingDetails.status", "==", "pending") // Listen only for pending emails
//     .onSnapshot((snapshot) => {
//         snapshot.docChanges().forEach(async (change) => {
//             if (change.type === "added") {
//                 const data = change.doc.data().bookingDetails;
//                 console.log("New email notification detected:", data);

//                 // Send Email
//                 try {
//                     await transporter.sendMail({
//                         from: process.env.EMAIL_USER,
//                         to: data.to,
//                         subject: data.subject,
//                         text: data.message,
//                     });

//                     console.log(`Email sent to ${data.to}`);

//                     // Update the status to "sent" after sending the email
//                     await db.collection("emailNotifications").doc(change.doc.id).update({
//                         "bookingDetails.status": "sent",
//                     });

//                     console.log(`Status updated to 'sent' for: ${change.doc.id}`);
//                 } catch (error) {
//                     console.error("Error sending email:", error);
//                 }
//             }
//         });
//     });

// console.log("Listening for new email notifications...");