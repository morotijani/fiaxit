const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : "";
        
        if (!token) {
            return res.status(401).json({ 
                message: "Authentication failed: No token provided" 
            });
        }
        
        // jwt.verify is synchronous when no callback is provided
        const decoded = jwt.verify(token, process.env.JWT_KEY);
        req.userData = decoded;
        next();
    } catch(err) {
        return res.status(401).json({
            message: "Authentication failed: Invalid token",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
}
