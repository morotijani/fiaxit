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
    } catch (err) {
        console.error('Redis connection error:', err);
    }
})();

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                method: "authentication",
                message: "Authentication required: No token provided."
            });
        }

        const token = authHeader.split(' ')[1];

        // Check blacklist
        const isBlacklisted = await redisClient.get(`blacklist:${token}`);
        if (isBlacklisted) {
            return res.status(401).json({
                success: false,
                method: "authentication",
                message: "Authentication failed: Token blacklisted."
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_KEY);

        // ALWAYS fetch fresh user from DB to ensure role/status are up to date
        const user = await User.findOne({
            where: { user_id: decoded.user_id }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                method: "authentication",
                message: "Authentication failed: User no longer exists."
            });
        }

        // Attach full DB user object to request
        req.userData = user.toJSON();
        req.token = token;

        next();
    } catch (error) {
        const msg = error.name === 'TokenExpiredError' ? "Token expired." : (error.name === 'JsonWebTokenError' ? "Invalid token." : "Authentication error.");
        return res.status(401).json({
            success: false,
            method: "authentication",
            message: `Authentication failed: ${msg}`,
            details: error.message
        });
    }
};

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    try {
        // req.userData is guaranteed to be the DB user object by authenticate middleware
        if (!req.userData || !req.userData.user_id) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Access denied."
            });
        }

        if (req.userData.user_role !== 'admin') {
            console.warn(`[AdminAccess] Denied for User ID: ${req.userData.user_id}, Email: ${req.userData.user_email}, Role: ${req.userData.user_role}`);
            return res.status(403).json({
                success: false,
                message: "Forbidden: Admin access required.",
                debug: process.env.NODE_ENV === 'development' ? { role: req.userData.user_role } : undefined
            });
        }

        next();
    } catch (error) {
        console.error('isAdmin check error:', error);
        res.status(500).json({
            success: false,
            message: "Error verifying admin status.",
            error: error.message
        });
    }
};

// Function to blacklist a token (not middleware)
const blacklistToken = async (token) => {
    try {
        const decoded = jwt.decode(token);
        if (decoded) {
            const expiryTime = decoded.exp - Math.floor(Date.now() / 1000);
            if (expiryTime > 0) {
                await redisClient.set(`blacklist:${token}`, 'true', { EX: expiryTime });
                console.log(`Token blacklisted for ${expiryTime} seconds`);
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error blacklisting token:', error);
        return false;
    }
};

module.exports = { authenticate, isAdmin, blacklistToken };
