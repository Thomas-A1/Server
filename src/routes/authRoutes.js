// src/routes/authRoutes.js
const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middlewares/verifytoken');

// Public routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerificationCode);
router.post('/logout', authController.logout);

// Protected routes - FIXED: Only one route for user profile
router.get('/user/profile', verifyToken, authController.getUserProfile);

// Bookmark routes
router.post('/bookmark', verifyToken, authController.addBookmark);
router.post('/unbookmark', verifyToken, authController.removeBookmark);
router.get('/bookmarks/:userId', verifyToken, authController.getUserBookmarks);

// School routes
router.get('/schools/knust-admission', authController.getKnustAdmissionDetails);

// Google OAuth routes
// Google OAuth routes
router.get(
    '/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
    '/auth/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/auth/google/failure',
        failureMessage: true,
    }),
    (req, res) => {
        try {
            // Create JWT payload
            const payload = {
                id: req.user.id,
                email: req.user.email,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
            };

            // Create JWT token
            const token = jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn: '7d',
            });

            // Redirect with token and user data
            const redirectUrl = `https://uni-ghana.vercel.app/landing-page?token=${token}&user=${encodeURIComponent(
                JSON.stringify({
                    id: req.user.id,
                    firstName: req.user.firstName,
                    lastName: req.user.lastName,
                    email: req.user.email,
                })
            )}`;

            res.redirect(redirectUrl);
        } catch (error) {
            console.error('Error in Google callback:', error);
            res.redirect(
                'https://uni-ghana.vercel.app/register?error=google_auth_failed'
            );
        }
    }
);

// Custom error handling
router.get('/auth/google/failure', (req, res) => {
    const errorMsg = req.session?.messages?.[0] || 'google_auth_failed';

    res.redirect(
        `https://uni-ghana.vercel.app/register?error=${encodeURIComponent(errorMsg)}`
    );
});

module.exports = router;
