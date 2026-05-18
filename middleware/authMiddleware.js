import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const verifyJWT = async (req, res, next) => {
    const token = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Forbidden: Invalid token' });
    }
};

export const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role.some(r => roles.includes(r))) {
            return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
        }
        next();
    };
};
