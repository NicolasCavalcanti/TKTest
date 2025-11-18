"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = void 0;
const error_1 = require("./error");
const normalizeRole = (role) => role.trim().toUpperCase();
const hasRequiredRole = (userRoles, requiredRoles) => {
    if (userRoles.length === 0) {
        return false;
    }
    const normalizedUserRoles = new Set(userRoles.map(normalizeRole));
    if (normalizedUserRoles.has('ADMIN')) {
        return true;
    }
    if (requiredRoles.length === 0) {
        return normalizedUserRoles.size > 0;
    }
    return requiredRoles.some((role) => normalizedUserRoles.has(normalizeRole(role)));
};
const requireRole = (...roles) => {
    const requiredRoles = roles.map(normalizeRole).filter((role) => role.length > 0);
    return (req, _res, next) => {
        const user = req.user;
        if (!user) {
            next(new error_1.HttpError(403, 'ACCESS_DENIED', 'Access denied'));
            return;
        }
        const userRoles = Array.isArray(user.roles) ? user.roles.map(normalizeRole) : [];
        if (!hasRequiredRole(userRoles, requiredRoles)) {
            next(new error_1.HttpError(403, 'INSUFFICIENT_ROLE', 'User lacks required role'));
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
//# sourceMappingURL=rbac.js.map