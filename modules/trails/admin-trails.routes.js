"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminTrailsRouter = void 0;
const express_1 = require("express");
const error_1 = require("../../middlewares/error");
const rbac_1 = require("../../middlewares/rbac");
const validation_1 = require("../../middlewares/validation");
const media_service_1 = require("../media/media.service");
const media_schemas_1 = require("../media/media.schemas");
const trail_schemas_1 = require("./trail.schemas");
const trail_service_1 = require("./trail.service");
const router = (0, express_1.Router)();
const extractRoles = (roles) => {
    if (!Array.isArray(roles)) {
        return [];
    }
    return roles
        .map((role) => (typeof role === 'string' ? role.trim() : ''))
        .filter((role) => role.length > 0);
};
router.get('/', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), (0, validation_1.validate)(trail_schemas_1.listAdminTrailsSchema), async (req, res, next) => {
    try {
        const query = req.query;
        const result = await trail_service_1.adminTrailService.listTrails(query);
        res.status(200).json(result);
    }
    catch (error) {
        next(error);
    }
});
router.post('/', (0, rbac_1.requireRole)('ADMIN', 'EDITOR'), (0, validation_1.validate)(trail_schemas_1.createAdminTrailSchema), async (req, res, next) => {
    try {
        const body = req.body;
        const actorRoles = extractRoles(req.user?.roles);
        const trail = await trail_service_1.adminTrailService.createTrail({ actorId: req.user?.sub, roles: actorRoles }, body, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(201).json({ trail });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), (0, validation_1.validate)(trail_schemas_1.getAdminTrailSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const trail = await trail_service_1.adminTrailService.getTrailById(params.id);
        if (!trail) {
            throw new error_1.HttpError(404, 'TRAIL_NOT_FOUND', 'Trail not found');
        }
        res.status(200).json({ trail });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:id', (0, rbac_1.requireRole)('ADMIN', 'EDITOR'), (0, validation_1.validate)(trail_schemas_1.updateAdminTrailSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const body = req.body;
        const actorRoles = extractRoles(req.user?.roles);
        const trail = await trail_service_1.adminTrailService.updateTrail({ actorId: req.user?.sub, roles: actorRoles }, params.id, body, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(200).json({ trail });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', (0, rbac_1.requireRole)('ADMIN'), (0, validation_1.validate)(trail_schemas_1.deleteAdminTrailSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const actorRoles = extractRoles(req.user?.roles);
        await trail_service_1.adminTrailService.deleteTrail({ actorId: req.user?.sub, roles: actorRoles }, params, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
router.post('/:id/media', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), (0, validation_1.validate)(media_schemas_1.createTrailMediaSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const body = req.body;
        const actorRoles = extractRoles(req.user?.roles);
        const upload = await media_service_1.adminMediaService.createTrailMediaUpload({ actorId: req.user?.sub, roles: actorRoles }, params.id, body, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(201).json(upload);
    }
    catch (error) {
        next(error);
    }
});
exports.adminTrailsRouter = router;
//# sourceMappingURL=admin-trails.routes.js.map