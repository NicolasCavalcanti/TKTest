"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = void 0;
const error_1 = require("./error");
const defaultKeyGenerator = (req) => {
    return req.ip || req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || 'unknown';
};
const rateLimit = ({ windowMs, max, keyGenerator }) => {
    if (windowMs <= 0) {
        throw new Error('windowMs must be greater than 0');
    }
    if (max <= 0) {
        throw new Error('max must be greater than 0');
    }
    const hits = new Map();
    return (req, _res, next) => {
        const now = Date.now();
        const key = keyGenerator ? keyGenerator(req) : defaultKeyGenerator(req);
        const entry = hits.get(key);
        if (!entry || entry.expiresAt <= now) {
            hits.set(key, { count: 1, expiresAt: now + windowMs });
            next();
            return;
        }
        if (entry.count >= max) {
            next(new error_1.HttpError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests'));
            return;
        }
        entry.count += 1;
        hits.set(key, entry);
        next();
    };
};
exports.rateLimit = rateLimit;
//# sourceMappingURL=rate-limit.js.map