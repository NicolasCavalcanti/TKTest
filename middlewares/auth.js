"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const error_1 = require("./error");
const ACCESS_TOKEN_COOKIE_NAMES = ['accessToken', 'access_token'];
const extractTokenFromRequest = (req) => {
    for (const cookieName of ACCESS_TOKEN_COOKIE_NAMES) {
        const tokenFromCookie = req.cookies?.[cookieName];
        if (typeof tokenFromCookie === 'string' && tokenFromCookie.trim().length > 0) {
            return tokenFromCookie.trim();
        }
    }
    const authorizationHeader = req.headers.authorization;
    if (authorizationHeader && authorizationHeader.trim().length > 0) {
        return authorizationHeader.replace(/^Bearer\s+/i, '').trim();
    }
    return undefined;
};
const authenticate = (options = {}) => {
    const { optional = false } = options;
    return (req, _res, next) => {
        const token = extractTokenFromRequest(req);
        if (!token) {
            if (optional) {
                next();
                return;
            }
            next(new error_1.HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required'));
            return;
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            next(new error_1.HttpError(500, 'JWT_SECRET_NOT_CONFIGURED', 'JWT secret is not configured'));
            return;
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, secret);
            req.user = decoded;
            next();
        }
        catch (error) {
            if (optional) {
                next();
                return;
            }
            next(new error_1.HttpError(401, 'INVALID_TOKEN', 'Invalid or expired token', error instanceof Error ? error.message : undefined));
        }
    };
};
exports.authenticate = authenticate;
//# sourceMappingURL=auth.js.map