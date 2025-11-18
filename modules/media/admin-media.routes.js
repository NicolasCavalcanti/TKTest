"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMediaRouter = void 0;
const express_1 = require("express");
const rbac_1 = require("../../middlewares/rbac");
const validation_1 = require("../../middlewares/validation");
const media_service_1 = require("./media.service");
const media_schemas_1 = require("./media.schemas");
const router = (0, express_1.Router)();
const extractRoles = (roles) => {
    if (!Array.isArray(roles)) {
        return [];
    }
    return roles
        .map((role) => (typeof role === 'string' ? role.trim() : ''))
        .filter((role) => role.length > 0);
};
router.delete('/:mediaId', (0, rbac_1.requireRole)('ADMIN', 'EDITOR'), (0, validation_1.validate)(media_schemas_1.deleteMediaSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const actorRoles = extractRoles(req.user?.roles);
        await media_service_1.adminMediaService.deleteMedia({ actorId: req.user?.sub, roles: actorRoles }, params.mediaId, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
exports.adminMediaRouter = router;
//# sourceMappingURL=admin-media.routes.js.map