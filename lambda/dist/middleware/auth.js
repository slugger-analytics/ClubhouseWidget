"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.optionalAuth = optionalAuth;
const aws_jwt_verify_1 = require("aws-jwt-verify");
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-2_tG7IQQ6G7';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';
let verifier = null;
function getVerifier() {
    if (!verifier) {
        verifier = aws_jwt_verify_1.CognitoJwtVerifier.create({
            userPoolId: USER_POOL_ID,
            tokenUse: 'access',
            clientId: CLIENT_ID || null,
        });
    }
    return verifier;
}
async function authMiddleware(req, res, next) {
    // Try to get token from cookie first, then Authorization header
    const cookieToken = req.cookies?.accessToken;
    const headerToken = req.headers.authorization?.split(' ')[1];
    const token = cookieToken || headerToken;
    if (!token) {
        res.status(401).json({ error: 'Unauthorized: No token provided' });
        return;
    }
    try {
        const payload = await getVerifier().verify(token);
        req.user = {
            cognitoSub: payload.sub,
            username: payload.username,
            email: payload.email,
        };
        next();
    }
    catch (error) {
        console.error('Token verification failed:', error);
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
}
function optionalAuth(req, res, next) {
    const cookieToken = req.cookies?.accessToken;
    const headerToken = req.headers.authorization?.split(' ')[1];
    const token = cookieToken || headerToken;
    if (!token) {
        next();
        return;
    }
    getVerifier()
        .verify(token)
        .then((payload) => {
        req.user = {
            cognitoSub: payload.sub,
            username: payload.username,
            email: payload.email,
        };
        next();
    })
        .catch(() => {
        // Token invalid, but continue without user
        next();
    });
}
//# sourceMappingURL=auth.js.map