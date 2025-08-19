// backend/controllers/applicationAuthController.js

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CompanyMetadata = require('../models/CompanyMetadata'); 

/**
 * Generates JWT access and refresh tokens for a user.
 * @param {object} user - The user object from the database.
 * @returns {{accessToken: string, refreshToken: string}}
 */
const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { userId: user._id, role: user.role, companyId: user.companyId },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
    );
    const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
    );
    return { accessToken, refreshToken };
};

/**
 * Step 1: Checks the company ID against the central server.
 * This is a public endpoint.
 */
const checkCompany = async (req, res) => {
    const { cID } = req.body;
    if (!cID) {
        return res.status(400).json({ success: false, message: 'Company ID is required.' });
    }
    try {
        // This query should be against your central database of companies
        const company = await CompanyMetadata.findOne({ companyID: cID });
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found.' });
        }
        res.status(200).json({
            success: true,
            companyURL: company.companyURL,
            companyName: company.companyName,
            companyLogo: company.companyLogo,
        });
    } catch (error) {
        console.error('Error checking company:', error);
        res.status(500).json({ success: false, message: 'Server error while checking company.' });
    }
};

/**
 * Step 2: Checks user's email and their OTP verification status.
 * This is a public endpoint.
 */
const checkOtpStatus = async (req, res) => {
    const User = req.db.model('User', require('../models/User').schema);
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required.' });
    }
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found for this company.' });
        }
        res.status(200).json({
            success: true,
            otpVerified: user.otpVerified,
            firstName: user.firstName,
        });
    } catch (error) {
        console.error('Error checking OTP status:', error);
        res.status(500).json({ success: false, message: 'Server error while checking user.' });
    }
};

/**
 * Step 3 (for new users): Verifies the OTP sent to the user.
 * This is a public endpoint.
 */
const verifyOtp = async (req, res) => {
    const User = req.db.model('User', require('../models/User').schema);
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }
    try {
        const user = await User.findOne({ email });
        if (!user || user.otp !== otp || new Date() > user.otpExpiry) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
        }
        user.otpVerified = true;
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        res.status(200).json({ success: true, message: 'OTP verified successfully.' });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ success: false, message: 'Server error during OTP verification.' });
    }
};

/**
 * Final Step: Logs the user in with their password.
 * This is a public endpoint.
 */
const login = async (req, res) => {
    const User = req.db.model('User', require('../models/User').schema);
    const { email, password, expoPushToken } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    try {
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const { accessToken, refreshToken } = generateTokens(user);
        user.refreshToken = refreshToken;
        if (expoPushToken) {
            user.expoPushToken = expoPushToken;
        }
        await user.save();

        res.status(200).json({
            success: true,
            accessToken,
            refreshToken, // Sending refresh token in the body for secure storage on the app
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                user_ID: user.user_ID,
            },
        });
    } catch (error) {
        console.error('Error during app login:', error);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
};

module.exports = {
    checkCompany,
    checkOtpStatus,
    verifyOtp,
    login,
};
