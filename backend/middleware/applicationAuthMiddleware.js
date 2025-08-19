// backend/middleware/applicationAuthMiddleware.js

const jwt = require('jsonwebtoken');

/**
 * Middleware to protect routes by verifying the JWT access token from the Authorization header.
 */
const protectApp = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

            // Attach user info to the request object
            req.user = decoded; 
            
            next();
        } catch (error) {
            console.error('Token verification failed:', error.message);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token provided' });
    }
};

module.exports = { protectApp };
