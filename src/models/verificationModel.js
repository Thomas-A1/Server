const { db, admin } = require('../config/firebase');

const verificationCodesRef = db.collection('verificationCodes'); // Use 'db' directly here

class VerificationModel {
    static async createVerificationCode(userId, email) {
        // Generate a random 5-digit code
        const code = Math.floor(10000 + Math.random() * 90000).toString();

        // Set expiration time (30 minutes from now)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);

        const verificationData = {
            userId,
            email,
            code,
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt), // Using admin.firestore is fine here
            verified: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp() // Using admin.firestore.FieldValue is fine here
        };

        await verificationCodesRef.add(verificationData); // Add to 'verificationCodes' collection
        return code;
    }

    static async verifyCode(userId, code) {
        const snapshot = await verificationCodesRef
            .where('userId', '==', userId)
            .where('code', '==', code)
            .where('verified', '==', false)
            .get();

        if (snapshot.empty) {
            return { success: false, message: 'Invalid verification code' };
        }

        const doc = snapshot.docs[0];
        const verificationData = doc.data();

        // Check if code is expired
        if (verificationData.expiresAt.toDate() < new Date()) {
            return { success: false, message: 'Verification code has expired' };
        }

        // Mark code as verified
        await doc.ref.update({ verified: true });

        // Update user's verification status
        await db.collection('users').doc(userId).update({
            emailVerified: true
        });

        return { success: true, message: 'Email verified successfully' };
    }
}

module.exports = VerificationModel;
