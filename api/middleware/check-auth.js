const jwt = require("jsonwebtoken");
const redis = require("redis");
const User = require('../models/user-model');
const UserKyc = require('../models/user-kyc-model');

// Create Redis client
let redisClient;
if (process.env.NODE_ENV !== 'production') {
    redisClient = redis.createClient({ 
        url: 'redis://127.0.0.1:6379'
    });
} else {
    redisClient = redis.createClient({ 
        username: process.env.REDIS_USERNAME || 'default',
        password: process.env.REDIS_PASSWORD,
        socket: {
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT || '6379')
        }
    });
}

// Connect to redis
(async () => {
    try {
        await redisClient.on('error', (err) => {
            console.error("Redis Client Error.", err);
        })

        await redisClient.on('ready', () => {
            console.log("Redis Client Started.")
        })

        await redisClient.connect();
        console.log("Connected to Redis.");
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

        // check if user in the kyc table and merge it to user
        const userKyc = await UserKyc.findOne({ // get user
            where: {
                kyc_for : decoded.user_id
            }
        })

        // Attach user data to request
        req.userData = decoded || user;
        
        if (userKyc) {
            // merge userKyc to user
            req.userData = { ...user, ...userKyc };
        }
        
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
                await redisClient.set(`blacklist:${token}`, 'true', {
                    EX: expiryTime
                });

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