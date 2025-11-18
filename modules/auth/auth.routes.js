"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const csrf_1 = require("../../middlewares/csrf");
const error_1 = require("../../middlewares/error");
const rate_limit_1 = require("../../middlewares/rate-limit");
const validation_1 = require("../../middlewares/validation");
const audit_service_1 = require("../audit/audit.service");
const auth_service_1 = require("./auth.service");
const auth_schemas_1 = require("./auth.schemas");
const cadastur_lookup_1 = require("../../services/cadastur-lookup");
const cookies_1 = require("../../services/cookies");
const ACCESS_TOKEN_COOKIE_NAME = 'accessToken';
const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
const ACCESS_TOKEN_COOKIE_ALIASES = [ACCESS_TOKEN_COOKIE_NAME, 'access_token'];
const REFRESH_TOKEN_COOKIE_ALIASES = [REFRESH_TOKEN_COOKIE_NAME, 'refresh_token'];
const ROLE_PERMISSIONS = {
    ADMIN: ['*'],
    EDITOR: ['CMS', 'TRILHAS', 'EXPEDICOES', 'GUIAS', 'CLIENTES', 'RESERVAS', 'INTEGRACOES', 'CONFIGURACOES'],
    OPERADOR: ['EXPEDICOES', 'RESERVAS', 'CLIENTES', 'GUIAS'],
    GUIA: ['EXPEDICOES', 'RESERVAS'],
};
const normalizeRole = (role) => role.trim().toUpperCase();
const normalizeRoles = (roles) => {
    if (!Array.isArray(roles)) {
        return [];
    }
    return roles
        .map((role) => (typeof role === 'string' ? normalizeRole(role) : ''))
        .filter((role) => role.length > 0);
};
const resolveUserRoles = (userRole, tokenRoles) => {
    const normalizedTokenRoles = normalizeRoles(tokenRoles);
    if (normalizedTokenRoles.length > 0) {
        return Array.from(new Set(normalizedTokenRoles));
    }
    if (userRole && userRole.trim().length > 0) {
        return [normalizeRole(userRole)];
    }
    return [];
};
const resolvePermissionsForRoles = (roles) => {
    if (roles.some((role) => normalizeRole(role) === 'ADMIN')) {
        return ['*'];
    }
    const permissions = new Set();
    for (const role of roles) {
        const normalized = normalizeRole(role);
        const rolePermissions = ROLE_PERMISSIONS[normalized];
        if (!rolePermissions) {
            continue;
        }
        if (rolePermissions.includes('*')) {
            permissions.clear();
            permissions.add('*');
            break;
        }
        if (!permissions.has('*')) {
            rolePermissions.forEach((permission) => permissions.add(permission));
        }
    }
    return permissions.has('*') ? ['*'] : Array.from(permissions);
};
const baseCookieOptions = () => (0, cookies_1.buildCookieOptions)();
const buildAccessCookieOptions = () => (0, cookies_1.buildCookieOptions)({ maxAge: auth_service_1.ACCESS_TOKEN_EXPIRATION_SECONDS * 1000 });
const buildRefreshCookieOptions = () => (0, cookies_1.buildCookieOptions)({ maxAge: auth_service_1.REFRESH_TOKEN_EXPIRATION_SECONDS * 1000 });
const getRefreshTokenFromRequest = (req) => {
    for (const name of REFRESH_TOKEN_COOKIE_ALIASES) {
        const token = req.cookies?.[name];
        if (typeof token === 'string' && token.trim().length > 0) {
            return token.trim();
        }
    }
    return undefined;
};
const clearAuthCookies = (res) => {
    const options = baseCookieOptions();
    for (const name of ACCESS_TOKEN_COOKIE_ALIASES) {
        res.clearCookie(name, options);
    }
    for (const name of REFRESH_TOKEN_COOKIE_ALIASES) {
        res.clearCookie(name, options);
    }
};
const setAuthCookies = (res, tokens) => {
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, tokens.accessToken, buildAccessCookieOptions());
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, buildRefreshCookieOptions());
};
const router = (0, express_1.Router)();
const authRateLimiter = (0, rate_limit_1.rateLimit)({
    windowMs: 60_000,
    max: 10,
});
router.use(authRateLimiter);
router.get('/csrf', (req, res) => {
    const csrfToken = (0, csrf_1.rotateCsrfToken)(req, res);
    res.status(200).json({ csrfToken });
});
router.post('/register', (0, validation_1.validate)(auth_schemas_1.registerSchema), async (req, res, next) => {
    const { name, email, password, user_type: userType, cadastur_number: cadasturNumber } = req.body;
    try {
        const { user, accessToken, refreshToken } = await auth_service_1.authService.register({
            name,
            email,
            password,
            userType,
            cadasturNumber,
        });
        setAuthCookies(res, { accessToken, refreshToken });
        const csrfToken = (0, csrf_1.rotateCsrfToken)(req, res);
        await (0, audit_service_1.audit)({
            userId: user.id,
            entity: 'user',
            entityId: user.id,
            action: 'REGISTER',
            diff: { email: user.email, role: user.role },
            ip: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.status(201).json({
            success: true,
            user,
            access_token: accessToken,
            refresh_token: refreshToken,
            csrfToken,
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/validate-cadastur', (0, validation_1.validate)(auth_schemas_1.validateCadasturSchema), async (req, res, next) => {
    const { name, cadastur_number: cadasturNumber } = req.body;
    const trimmedName = name.trim();
    const normalizedNumber = cadasturNumber.replace(/\D/g, '');
    if (normalizedNumber.length !== 11) {
        res.status(400).json({
            valid: false,
            message: 'Número CADASTUR deve conter 11 dígitos',
        });
        return;
    }
    try {
        const validation = await cadastur_lookup_1.cadasturLookupService.validate(trimmedName, normalizedNumber);
        if (!validation.numberExists) {
            res.status(404).json({
                valid: false,
                message: 'Número CADASTUR não encontrado na base oficial.',
                code: 'CADASTUR_NUMBER_NOT_FOUND',
            });
            return;
        }
        if (!validation.valid) {
            res.status(409).json({
                valid: false,
                message: 'O nome informado não corresponde ao cadastro oficial. Verifique a grafia conforme CADASTUR.',
                code: 'CADASTUR_NAME_MISMATCH',
                suggestions: validation.availableNames,
            });
            return;
        }
        res.status(200).json({
            valid: true,
            exact_match: validation.exactMatch,
            official_name: validation.matchedName,
            normalized_official_name: validation.normalizedMatchedName,
            suggestions: validation.availableNames,
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/login', (0, validation_1.validate)(auth_schemas_1.loginSchema), async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const { user, accessToken, refreshToken } = await auth_service_1.authService.login(email, password);
        setAuthCookies(res, { accessToken, refreshToken });
        const csrfToken = (0, csrf_1.rotateCsrfToken)(req, res);
        await (0, audit_service_1.audit)({
            userId: user.id,
            entity: 'user',
            entityId: user.id,
            action: 'LOGIN',
            diff: { email: user.email },
            ip: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.status(200).json({
            success: true,
            user,
            access_token: accessToken,
            refresh_token: refreshToken,
            csrfToken,
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/refresh', async (req, res, next) => {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
        next(new error_1.HttpError(401, 'REFRESH_TOKEN_MISSING', 'Refresh token is missing'));
        return;
    }
    try {
        const { user, accessToken, refreshToken: newRefreshToken } = await auth_service_1.authService.refresh(refreshToken);
        setAuthCookies(res, { accessToken, refreshToken: newRefreshToken });
        const csrfToken = (0, csrf_1.rotateCsrfToken)(req, res);
        res.status(200).json({
            success: true,
            user,
            access_token: accessToken,
            refresh_token: newRefreshToken,
            csrfToken,
        });
    }
    catch (error) {
        clearAuthCookies(res);
        (0, csrf_1.clearCsrfToken)(res);
        next(error);
    }
});
router.post('/logout', async (req, res, next) => {
    const refreshToken = getRefreshTokenFromRequest(req);
    try {
        await auth_service_1.authService.logout(refreshToken);
    }
    catch (error) {
        next(error);
        return;
    }
    clearAuthCookies(res);
    // O clearCsrfToken(res) é chamado dentro do rotateCsrfToken(req, res)
    // para limpar o cookie do token antigo.
    const csrfToken = (0, csrf_1.rotateCsrfToken)(req, res);
    res.status(200).json({ success: true, csrfToken });
});
router.get('/me', (0, auth_1.authenticate)({ optional: true }), async (req, res, next) => {
    const payload = req.user;
    if (!payload?.sub) {
        const csrfToken = (0, csrf_1.ensureCsrfToken)(req, res);
        res.status(200).json({ authenticated: false, csrfToken });
        return;
    }
    try {
        const profile = await auth_service_1.authService.getUserProfile(payload.sub);
        if (!profile) {
            const csrfToken = (0, csrf_1.ensureCsrfToken)(req, res);
            res.status(200).json({ authenticated: false, csrfToken });
            return;
        }
        const roles = resolveUserRoles(profile.role, payload.roles);
        const permissions = resolvePermissionsForRoles(roles);
        const csrfToken = (0, csrf_1.ensureCsrfToken)(req, res);
        res.status(200).json({
            authenticated: true,
            user: profile,
            roles,
            permissions,
            csrfToken,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter = router;
//# sourceMappingURL=auth.routes.js.map