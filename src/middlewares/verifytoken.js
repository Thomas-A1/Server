const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'No token provided'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT verification error:', err);

            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token expired'
                });
            } else if (err.name === 'JsonWebTokenError') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid token format'
                });
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Failed to authenticate token'
                });
            }
        }

        req.user = decoded;
        next();
    });
}

module.exports = verifyToken;