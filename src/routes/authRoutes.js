// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Public routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerificationCode);
router.get('/user/profile', authController.getUserProfile);
router.post('/logout', authController.logout);
router.post('/bookmark', authController.addBookmark);
router.post('/unbookmark', authController.removeBookmark);
router.get('/bookmarks/:userId', authController.getUserBookmarks);
router.get('/schools/knust-admission', authController.getKnustAdmissionDetails);


module.exports = router;