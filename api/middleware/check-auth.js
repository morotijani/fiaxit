const jwt = require("jsonwebtoken");
const redis = require("redis");
const User = require('../models/user-model');

// Create Redis client
const redisClient = redis.createClient({
    // url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
    url: 'redis://127.0.0.1:6379'
});

// Connect to redis
(async () => {
    try {
        await redisClient.on('error', (err) => {
            console.error("Redis Client error", err);
        })

        await redisClient.on('ready', () => {
            console.log("Redis Client started")
        })

        await redisClient.connect();
        console.log("Connected to Redis");
    } catch(err) {
        console.error('Redis connection error:', err);
    }
})();

const authenticate = async(req, res, next) => {
    try {
        // Get token from authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false, 
                method: "authentication", 
                message: "Authentication required: No token provided."
            });
        }

        // Extract the token
        const token = authHeader.split(' ')[1];

        // Check if token is blacklisted
        const isBlacklisted = await redisClient.get(`blacklist:${token}`);
        if (isBlacklisted) {
            return res.status(401).json({
                success: false, 
                method: "authentication", 
                message: "Authentication failed: Token blacklisted (Token has been revoked) Please login again."
            });
        }

        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_KEY);

        const user = await User.findOne({ // get user
            where: {
                user_id : decoded.user_id
            }
        })

        if (!user) {
            return res.status(401).json({
                success: false, 
                method: "authentication", 
                message: "Authentication failed: User not found."
            });
        }
        //return user;
        
        // Attach user data to request
        req.userData = decoded;
        req.token = token; // Store token for potential use in other middleware/controllers
        
        // Continue to the next middleware/router handler
        next();
    } catch(error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false, 
                method: "authentication", 
                message: "Authentication failed: Token expired. Please login again."
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false, 
                method: "authentication", 
                message: "Authentication failed: Invalid token. Please login again."
            });
        }

        console.error('Authentication error:', error);
        return res.status(500).json({
            success: false, 
            method: "authentication", 
            message: 'Authentication failed: An error occurred while authenticating the user.', 
            error: error.message
        });
    }
};

// Function to blacklist a token (not middleware)
const blacklistToken = async (token) => {
    try {
        const decoded = jwt.decode(token);
        if (decoded) {
            // Calculate remaining time until token expiry
            const expiryTime = decoded.exp - Math.floor(Date.now() / 1000);

            if (expiryTime > 0) {
                // Store token in blacklist until its original expiration time
                const rediz = await redisClient.set(`blacklist:${token}`, 'true', {
                    EX: expiryTime
                });
                if (!rediz) {
                    console.log('redis problem');
                }

                console.log(`Token blacklisted for ${expiryTime} seconds`);
                return true;
            }
        }
        console.error('Error blacklisting token:', error);
        return false;
    } catch (error) {
        console.error('Error blacklisting token:', error);
        return false;
    }
};

module.exports = { authenticate, blacklistToken };