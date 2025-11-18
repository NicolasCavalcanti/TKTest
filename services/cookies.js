"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCookieOptions = exports.resolveCookieDomain = void 0;
const isProduction = process.env.NODE_ENV === 'production';
const resolveCookieDomain = () => {
    const domain = process.env.AUTH_COOKIE_DOMAIN ?? process.env.COOKIE_DOMAIN;
    if (domain && domain.trim().length > 0) {
        return domain.trim();
    }
    return undefined;
};
exports.resolveCookieDomain = resolveCookieDomain;
const buildCookieOptions = (overrides = {}) => {
    const baseOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
    };
    const domain = (0, exports.resolveCookieDomain)();
    if (domain) {
        baseOptions.domain = domain;
    }
    return { ...baseOptions, ...overrides };
};
exports.buildCookieOptions = buildCookieOptions;
//# sourceMappingURL=cookies.js.map