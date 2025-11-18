"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUsersRouter = void 0;
const express_1 = require("express");
const error_1 = require("../../middlewares/error");
const rbac_1 = require("../../middlewares/rbac");
const validation_1 = require("../../middlewares/validation");
const user_schemas_1 = require("./user.schemas");
const user_service_1 = require("./user.service");
const router = (0, express_1.Router)();
const getActorRoles = (roles) => {
    if (!Array.isArray(roles)) {
        return [];
    }
    return roles
        .map((role) => (typeof role === 'string' ? role.trim() : ''))
        .filter((role) => role.length > 0);
};
router.get('/', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), (0, validation_1.validate)(user_schemas_1.listAdminUsersSchema), async (req, res, next) => {
    try {
        const query = req.query;
        const result = await user_service_1.adminUserService.listUsers({
            page: query.page,
            pageSize: query.pageSize,
            search: query.search,
            role: query.role,
            status: query.status ? query.status : undefined,
            sort: query.sort,
        });
        res.status(200).json(result);
    }
    catch (error) {
        next(error);
    }
});
router.post('/', (0, rbac_1.requireRole)('ADMIN'), (0, validation_1.validate)(user_schemas_1.createAdminUserSchema), async (req, res, next) => {
    try {
        const body = req.body;
        const actorRoles = getActorRoles(req.user?.roles);
        const user = await user_service_1.adminUserService.createUser({ actorId: req.user?.sub, roles: actorRoles }, body, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(201).json({ user });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR', 'GUIA'), (0, validation_1.validate)(user_schemas_1.getAdminUserSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const actorRoles = getActorRoles(req.user?.roles);
        const normalizedRoles = new Set(actorRoles.map((role) => role.toUpperCase()));
        const isPrivileged = normalizedRoles.has('ADMIN') ||
            normalizedRoles.has('EDITOR') ||
            normalizedRoles.has('OPERADOR');
        const isSelf = req.user?.sub === params.id;
        if (!isPrivileged && !isSelf) {
            throw new error_1.HttpError(403, 'INSUFFICIENT_ROLE', 'User lacks required role');
        }
        const user = await user_service_1.adminUserService.getUserById(params.id);
        if (!user) {
            throw new error_1.HttpError(404, 'USER_NOT_FOUND', 'User not found');
        }
        res.status(200).json({ user });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:id', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'GUIA'), (0, validation_1.validate)(user_schemas_1.updateAdminUserSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const body = req.body;
        const actorRoles = getActorRoles(req.user?.roles);
        const updateData = {
            ...body,
            status: body.status ? body.status : undefined,
        };
        const user = await user_service_1.adminUserService.updateUser({ actorId: req.user?.sub, roles: actorRoles }, params.id, updateData, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(200).json({ user });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', (0, rbac_1.requireRole)('ADMIN'), (0, validation_1.validate)(user_schemas_1.deleteAdminUserSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const actorRoles = getActorRoles(req.user?.roles);
        await user_service_1.adminUserService.softDeleteUser({ actorId: req.user?.sub, roles: actorRoles }, params.id, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
exports.adminUsersRouter = router;
//# sourceMappingURL=admin-users.routes.js.map