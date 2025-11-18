"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminExpeditionsRouter = void 0;
const express_1 = require("express");
const error_1 = require("../../middlewares/error");
const rbac_1 = require("../../middlewares/rbac");
const validation_1 = require("../../middlewares/validation");
const expedition_service_1 = require("./expedition.service");
const expedition_schemas_1 = require("./expedition.schemas");
const router = (0, express_1.Router)();
const extractRoles = (roles) => {
    if (!Array.isArray(roles)) {
        return [];
    }
    return roles
        .map((role) => (typeof role === 'string' ? role.trim() : ''))
        .filter((role) => role.length > 0);
};
router.get('/', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR', 'GUIA'), (0, validation_1.validate)(expedition_schemas_1.listAdminExpeditionsSchema), async (req, res, next) => {
    try {
        const query = req.query;
        const result = await expedition_service_1.adminExpeditionService.listExpeditions(query);
        res.status(200).json(result);
    }
    catch (error) {
        next(error);
    }
});
router.post('/', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR', 'GUIA'), (0, validation_1.validate)(expedition_schemas_1.createAdminExpeditionSchema), async (req, res, next) => {
    try {
        const body = req.body;
        const actorRoles = extractRoles(req.user?.roles);
        const expedition = await expedition_service_1.adminExpeditionService.createExpedition({ actorId: req.user?.sub, roles: actorRoles }, body, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(201).json({ expedition });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR', 'GUIA'), (0, validation_1.validate)(expedition_schemas_1.getAdminExpeditionSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const expedition = await expedition_service_1.adminExpeditionService.getExpeditionById(params.id);
        if (!expedition) {
            throw new error_1.HttpError(404, 'EXPEDITION_NOT_FOUND', 'Expedition not found');
        }
        res.status(200).json({ expedition });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:id', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR', 'GUIA'), (0, validation_1.validate)(expedition_schemas_1.updateAdminExpeditionSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const body = req.body;
        const actorRoles = extractRoles(req.user?.roles);
        const expedition = await expedition_service_1.adminExpeditionService.updateExpedition({ actorId: req.user?.sub, roles: actorRoles }, params.id, body, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(200).json({ expedition });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:id/status', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), (0, validation_1.validate)(expedition_schemas_1.updateAdminExpeditionStatusSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const body = req.body;
        const actorRoles = extractRoles(req.user?.roles);
        const expedition = await expedition_service_1.adminExpeditionService.updateExpeditionStatus({ actorId: req.user?.sub, roles: actorRoles }, params.id, body, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(200).json({ expedition });
    }
    catch (error) {
        next(error);
    }
});
exports.adminExpeditionsRouter = router;
//# sourceMappingURL=admin-expeditions.routes.js.map