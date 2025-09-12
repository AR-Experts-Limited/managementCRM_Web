// backend/routes/applicationAuthRoutes.js

const express = require('express');
const router = express.Router();
const {
    checkCompany,
    checkOtpStatus,
    verifyOtp,
    login,
    forgotPassword,
    resetPassword,
    refreshToken,
} = require('../controllers/applicationAuthController');

// --- PUBLIC AUTHENTICATION ROUTES FOR THE MOBILE APP ---

// Route for Step 1: Check Company ID
router.post('/check-company', checkCompany);

// Route for Step 2: Check user's email and OTP status
router.post('/check-otp-status', checkOtpStatus);

// Route for Step 3 (New Users): Verify OTP
router.post('/verify-otp', verifyOtp);

// Route for Final Step: Login with email and password
router.post('/login', login);

router.post('/forgot-password', forgotPassword);

router.post('/reset-password/:token', resetPassword);

// Route for Refreshing Token
router.post('/refresh-token', refreshToken); 


module.exports = router;
