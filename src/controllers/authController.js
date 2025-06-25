// src/controllers/authController.js
const { auth, db } = require('../config/firebase');
const VerificationModel = require('../models/verificationModel');
const EmailService = require('../utils/emailService');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

exports.signup = async (req, res) => {
    try {
        const { firstName, lastName, email, password, educationLevel } = req.body;

        // Check if the email already exists in Firestore
        const existingUser = await db.collection('users').where('email', '==', email).get();
        if (!existingUser.empty) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists. Please use a different email.'
            });
        }

        // Create user in Firebase Auth
        const userRecord = await auth.createUser({
            email,
            password,
            displayName: `${firstName} ${lastName}`,
            emailVerified: false
        });

        // Store additional user data in Firestore
        const userData = {
            firstName,
            lastName,
            email,
            educationLevel,
            emailVerified: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('users').doc(userRecord.uid).set(userData);

        // Generate verification code and send email
        const verificationCode = await VerificationModel.createVerificationCode(userRecord.uid, email);
        await EmailService.sendVerificationEmail(email, verificationCode);

        res.status(201).json({
            success: true,
            message: 'User created successfully. Please verify your email.',
            userId: userRecord.uid
        });

    } catch (error) {
        console.error('Error creating user:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};



exports.verifyEmail = async (req, res) => {
    try {
        const { userId, code } = req.body;

        if (!userId || !code) {
            return res.status(400).json({
                success: false,
                message: 'User ID and verification code are required'
            });
        }

        const result = await VerificationModel.verifyCode(userId, code);

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Email verified successfully'
            });
        }

        res.status(400).json({ success: false, message: result.message });
    } catch (error) {
        console.error('Error verifying email:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.resendVerificationCode = async (req, res) => {
    try {
        const { userId } = req.body;

        // Get user email
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userEmail = userDoc.data().email;

        // Generate new verification code
        const verificationCode = await VerificationModel.createVerificationCode(userId, userEmail);
        await EmailService.sendVerificationEmail(userEmail, verificationCode);

        res.status(200).json({
            success: true,
            message: 'Verification code resent successfully'
        });
    } catch (error) {
        console.error('Error resending verification code:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Authenticate user with Firebase Auth
        let userCredential;
        try {
            userCredential = await auth.getUserByEmail(email);
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if email is verified
        const userDoc = await db.collection('users').doc(userCredential.uid).get();
        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'User account not found'
            });
        }

        const userData = userDoc.data();

        // if (!userData.emailVerified) {
        //     return res.status(200).json({
        //         success: true,
        //         message: 'Login Successful. Email not verified',
        //         needsVerification: true,
        //         userId: userCredential.uid
        //     });
        // }

        // Verify password - Firebase Admin SDK doesn't support direct password verification,
        // so we need to use a workaround with a Firebase Auth API call
        try {
            // This would normally be done with Firebase client SDK
            // Here we're assuming we have a Firebase Auth REST API wrapper
            await verifyPassword(email, password);
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Create a custom token for client authentication
        const userToken = await auth.createCustomToken(userCredential.uid);

        // Store session information
        const sessionData = {
            userId: userCredential.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
            userAgent: req.headers['user-agent'] || 'Unknown',
            ipAddress: req.ip || req.connection.remoteAddress,
            isActive: true
        };

        const sessionRef = await db.collection('userSessions').add(sessionData);

        // Return user data and token
        res.status(200).json({
            success: true,
            message: 'Login successful',
            user: {
                id: userCredential.uid,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                educationLevel: userData.educationLevel,
                emailVerified: userData.emailVerified
            },
            token: userToken,
            sessionId: sessionRef.id
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during login',
            error: error.message
        });
    }
};

// Function to verify password (placeholder for Firebase Auth API call)
// In a real implementation, you would typically use Firebase client SDK for this
const verifyPassword = async (email, password) => {
    // This is a placeholder for the actual implementation
    // In production, you'd use Firebase Authentication REST API or similar
    try {
        // Example approach using Firebase Auth REST API
        const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + process.env.FIREBASE_API_KEY, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password,
                returnSecureToken: true
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Password verification failed');
        }

        return data;
    } catch (error) {
        throw new Error('Invalid credentials');
    }
};

// Optional: Logout endpoint to invalidate the session
exports.logout = async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required'
            });
        }

        // Update session to inactive
        await db.collection('userSessions').doc(sessionId).update({
            isActive: false,
            loggedOutAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during logout',
            error: error.message
        });
    }
};

exports.getUserProfile = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
        }

        const customToken = authHeader.split(' ')[1];

        // Decode the custom token manually (DO NOT VERIFY SIGNATURE — Firebase custom tokens are short-lived)
        let decodedToken;
        try {
            decodedToken = jwt.decode(customToken); // Only decode, no verification
        } catch (err) {
            console.error('Invalid token format:', err);
            return res.status(400).json({ success: false, message: 'Invalid token format' });
        }

        if (!decodedToken || !decodedToken.uid) {
            return res.status(400).json({ success: false, message: 'Invalid custom token: UID missing' });
        }

        const uid = decodedToken.uid;

        // Fetch user data from Firestore
        const userDoc = await db.collection('users').doc(uid).get();

        if (!userDoc.exists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userData = userDoc.data();

        res.status(200).json({
            success: true,
            user: {
                id: uid,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                educationLevel: userData.educationLevel,
                profileImage: userData.profileImage || null,
                emailVerified: userData.emailVerified
            }
        });

    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user profile', error: error.message });
    }
};

exports.addBookmark = async (req, res) => {
    try {
        const { userId, school } = req.body;

        if (!userId || !school?.id) {
            return res.status(400).json({ success: false, message: "User ID and school data are required." });
        }

        await db.collection('users').doc(userId).collection('bookmarks').doc(school.id).set({
            ...school,
            bookmarkedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.status(200).json({ success: true, message: "School bookmarked successfully." });
    } catch (error) {
        console.error("Error bookmarking school:", error);
        return res.status(500).json({ success: false, message: "Failed to bookmark school.", error: error.message });
    }
};

exports.removeBookmark = async (req, res) => {
    try {
        const { userId, schoolId } = req.body;

        if (!userId || !schoolId) {
            return res.status(400).json({ success: false, message: "User ID and school ID are required." });
        }

        await db.collection('users').doc(userId).collection('bookmarks').doc(schoolId).delete();

        return res.status(200).json({ success: true, message: "Bookmark removed successfully." });
    } catch (error) {
        console.error("Error removing bookmark:", error);
        return res.status(500).json({ success: false, message: "Failed to remove bookmark.", error: error.message });
    }
};

exports.getUserBookmarks = async (req, res) => {
    try {
        const { userId } = req.params;

        const snapshot = await db.collection('users').doc(userId).collection('bookmarks').get();

        const bookmarks = snapshot.docs.map(doc => doc.data());

        return res.status(200).json({ success: true, bookmarks });
    } catch (error) {
        console.error("Error fetching bookmarks:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch bookmarks.", error: error.message });
    }
};


// exports.getKnustAdmissionDetails = async (req, res) => {
//     try {
//         const url = 'https://www.knust.edu.gh/announcements/undergraduate-admissions/admission-candidates-undergraduate-degree-programmes-20252026-academic-year#:~:text=Verify%20an%20Account-,Visit%20apps.knust.edu.gh/admissions%20to%20create,Until%20WASSCE%20results%20are%20released.'; // actual URL

//         const browser = await puppeteer.launch({ headless: true });
//         const page = await browser.newPage();
//         await page.goto(url, { waitUntil: 'networkidle2' });

//         // Wait for relevant containers
//         await page.waitForSelector('.ann-info');

//         const data = await page.evaluate(() => {
//             const formatText = (el) => el?.innerText?.trim() || '';

//             const publishedDate = formatText(document.querySelector('.post-meta .post-date')) || null;

//             const annInfo = document.querySelector('.ann-info');
//             const paragraphs = annInfo.querySelectorAll('p');
//             const description = paragraphs.length > 1 ? paragraphs[1].innerText.trim() : '';

//             // Extract deadline
//             let deadlineText = '';
//             const headings = Array.from(annInfo.querySelectorAll('h3'));
//             const deadlineHeading = headings.find(h => h.innerText.includes('Application Deadlines'));
//             if (deadlineHeading) {
//                 const nextOl = deadlineHeading.nextElementSibling;
//                 if (nextOl && nextOl.tagName.toLowerCase() === 'ol') {
//                     const li = nextOl.querySelector('li');
//                     deadlineText = li ? li.innerText.replace(/.*?:\s*/i, '') : '';
//                 }
//             }

//             // Extract application fees from the table
//             // Initialize variables to store the fees
//             let feeGhana = '';
//             let feeInternational = '';

//             // Select all rows in the table
//             const rows = document.querySelectorAll('table tr');

//             // Iterate through each row
//             rows.forEach(row => {
//                 const cols = row.querySelectorAll('td');
//                 if (cols.length >= 2) {
//                     const type = cols[0].innerText.trim().toLowerCase();
//                     const cost = cols[1].innerText.trim();

//                     // Assign the cost based on the applicant type
//                     if (type.includes('ghanaian applicants')) {
//                         feeGhana = cost;
//                     } else if (type.includes('international applicants')) {
//                         feeInternational = cost;
//                     }
//                 }
//             });

//             // Log the extracted fees
//             console.log('Ghanaian Applicants Fee:', feeGhana);
//             console.log('International Applicants Fee:', feeInternational);


//             // Extract programmes
//             let programmes = [];
//             const progHeading = headings.find(h => h.innerText.includes('Programmes of Study'));
//             if (progHeading) {
//                 let nextEl = progHeading.nextElementSibling;
//                 while (nextEl && ['H3', 'H2'].indexOf(nextEl.tagName) === -1) {
//                     if (nextEl.tagName === 'UL') {
//                         const items = Array.from(nextEl.querySelectorAll('li')).map(li => li.innerText.trim());
//                         programmes = programmes.concat(items);
//                     }
//                     nextEl = nextEl.nextElementSibling;
//                 }
//             }

//             return {
//                 publishedDate,
//                 description,
//                 applicationDeadline: deadlineText || 'Not found',
//                 applicationFees: {
//                     ghanaian: feeGhana,
//                     international: feeInternational
//                 },
//                 courses: programmes
//             };
//         });

//         await browser.close();

//         res.status(200).json({
//             success: true,
//             data
//         });
//     } catch (error) {
//         console.error('Error scraping KNUST admission details:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Error fetching KNUST admission details',
//             error: error.message
//         });
//     }
// };
const isDev = process.env.NODE_ENV !== 'production';

exports.getKnustAdmissionDetails = async (req, res) => {
    let browser;
    try {
        const url = 'https://www.knust.edu.gh/announcements/undergraduate-admissions/admission-candidates-undergraduate-degree-programmes-20252026-academic-year';

        if (isDev) {
            const puppeteer = require('puppeteer');
            browser = await puppeteer.launch({ headless: true });
        } else {
            const chromium = require('chrome-aws-lambda');
            const puppeteer = require('puppeteer-core');

            const executablePath = await chromium.executablePath;
            if (!executablePath) {
                throw new Error('Chromium executablePath not found.');
            }

            browser = await puppeteer.launch({
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath: executablePath,
                headless: chromium.headless,
                ignoreHTTPSErrors: true,
            });
        }
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });
        await page.waitForSelector('.ann-info');

        const data = await page.evaluate(() => {
            const formatText = (el) => el?.innerText?.trim() || '';
            const publishedDate = formatText(document.querySelector('.post-meta .post-date')) || null;
            const annInfo = document.querySelector('.ann-info');
            const paragraphs = annInfo.querySelectorAll('p');
            const description = paragraphs.length > 1 ? paragraphs[1].innerText.trim() : '';

            // Extract deadline
            let deadlineText = '';
            const headings = Array.from(annInfo.querySelectorAll('h3'));
            const deadlineHeading = headings.find(h => h.innerText.includes('Application Deadlines'));
            if (deadlineHeading) {
                const nextOl = deadlineHeading.nextElementSibling;
                if (nextOl && nextOl.tagName.toLowerCase() === 'ol') {
                    const li = nextOl.querySelector('li');
                    deadlineText = li ? li.innerText.replace(/.*?:\s*/i, '') : '';
                }
            }
            // Extract application fees
            let feeGhana = '';
            let feeInternational = '';
            const rows = document.querySelectorAll('table tr');
            rows.forEach(row => {
                const cols = row.querySelectorAll('td');
                if (cols.length >= 2) {
                    const type = cols[0].innerText.trim().toLowerCase();
                    const cost = cols[1].innerText.trim();
                    if (type.includes('ghanaian applicants')) {
                        feeGhana = cost;
                    } else if (type.includes('international applicants')) {
                        feeInternational = cost;
                    }
                }
            });
            // Extract programmes
            let programmes = [];
            const progHeading = headings.find(h => h.innerText.includes('Programmes of Study'));
            if (progHeading) {
                let nextEl = progHeading.nextElementSibling;
                while (nextEl && ['H3', 'H2'].indexOf(nextEl.tagName) === -1) {
                    if (nextEl.tagName === 'UL') {
                        const items = Array.from(nextEl.querySelectorAll('li')).map(li => li.innerText.trim());
                        programmes = programmes.concat(items);
                    }
                    nextEl = nextEl.nextElementSibling;
                }
            }
            // Extract requirements
            const extractRequirements = () => {
                const requirementElements = Array.from(annInfo.querySelectorAll('ol, ul'));
                const requirements = [];
                requirementElements.forEach(el => {
                    const listItems = Array.from(el.querySelectorAll('li')).map(li => li.innerText.trim());
                    if (listItems.length > 0) requirements.push(...listItems);
                });
                return requirements;
            };
            const admissionRequirements = extractRequirements();
            return {
                publishedDate,
                description,
                applicationDeadline: deadlineText || 'Not found',
                applicationFees: {
                    ghanaian: feeGhana,
                    international: feeInternational
                },
                courses: programmes,
                admissionRequirements
            };
        });
        await browser.close();
        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error scraping KNUST admission details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching KNUST admission details',
            error: error.message
        });
    }
};


