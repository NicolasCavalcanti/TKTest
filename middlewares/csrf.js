"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfProtection = exports.clearCsrfToken = exports.rotateCsrfToken = exports.ensureCsrfToken = void 0;
const node_crypto_1 = require("node:crypto");
const cookies_1 = require("../services/cookies");
const error_1 = require("./error");
const CSRF_COOKIE_NAME = 'csrfToken';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TOKEN_BYTES = 32;
const CSRF_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const buildCsrfCookieOptions = () => (0, cookies_1.buildCookieOptions)({
    httpOnly: false,
    maxAge: CSRF_COOKIE_MAX_AGE,
});
const generateToken = () => (0, node_crypto_1.randomBytes)(TOKEN_BYTES).toString('hex');
const readTokenFromCookie = (req) => {
    const token = req.cookies?.[CSRF_COOKIE_NAME];
    if (typeof token === 'string' && token.trim().length > 0) {
        return token.trim();
    }
    return undefined;
};
const assignToken = (req, res, force = false) => {
    const existing = force ? undefined : readTokenFromCookie(req);
    const token = existing ?? generateToken();
    if (!existing || force) {
        res.cookie(CSRF_COOKIE_NAME, token, buildCsrfCookieOptions());
    }
    req.csrfToken = token;
    res.locals.csrfToken = token;
    return token;
};
const ensureCsrfToken = (req, res) => assignToken(req, res);
exports.ensureCsrfToken = ensureCsrfToken;
const rotateCsrfToken = (req, res) => assignToken(req, res, true);
exports.rotateCsrfToken = rotateCsrfToken;
const clearCsrfToken = (res) => {
    res.clearCookie(CSRF_COOKIE_NAME, buildCsrfCookieOptions());
    if (res.locals.csrfToken) {
        delete res.locals.csrfToken;
    }
};
exports.clearCsrfToken = clearCsrfToken;
const csrfProtection = (req, res, next) => {
    const token = assignToken(req, res);
    if (SAFE_METHODS.has((req.method || 'GET').toUpperCase())) {
        next();
        return;
    }
    const headerToken = req.get(CSRF_HEADER_NAME) ?? req.get(CSRF_HEADER_NAME.toUpperCase());
    if (!headerToken) {
        next(new error_1.HttpError(403, 'CSRF_TOKEN_MISSING', 'CSRF token header is required'));
        return;
    }
    const provided = headerToken.trim();
    if (provided.length === 0 || provided.length !== token.length) {
        next(new error_1.HttpError(403, 'CSRF_TOKEN_INVALID', 'Invalid CSRF token'));
        return;
    }
    try {
        const expectedBuffer = Buffer.from(token, 'utf8');
        const providedBuffer = Buffer.from(provided, 'utf8');
        if (expectedBuffer.length !== providedBuffer.length || !(0, node_crypto_1.timingSafeEqual)(expectedBuffer, providedBuffer)) {
            throw new Error('CSRF token mismatch');
        }
    }
    catch (error) {
        next(new error_1.HttpError(403, 'CSRF_TOKEN_INVALID', 'Invalid CSRF token', error instanceof Error ? error.message : undefined));
        return;
    }
    next();
};
exports.csrfProtection = csrfProtection;
//# sourceMappingURL=csrf.js.map