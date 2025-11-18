"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminParksRouter = void 0;
const express_1 = require("express");
const rbac_1 = require("../../middlewares/rbac");
const validation_1 = require("../../middlewares/validation");
const geo_service_1 = require("./geo.service");
const geo_schemas_1 = require("./geo.schemas");
const router = (0, express_1.Router)();
const getActorRoles = (roles) => {
    if (!Array.isArray(roles)) {
        return [];
    }
    return roles
        .map((role) => (typeof role === 'string' ? role.trim() : ''))
        .filter((role) => role.length > 0);
};
router.get('/', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), (0, validation_1.validate)(geo_schemas_1.listParksSchema), async (req, res, next) => {
    try {
        const query = req.query;
        const parks = await geo_service_1.adminGeoService.listParks(query);
        res.status(200).json({ parks });
    }
    catch (error) {
        next(error);
    }
});
router.post('/', (0, rbac_1.requireRole)('ADMIN', 'EDITOR'), (0, validation_1.validate)(geo_schemas_1.createParkSchema), async (req, res, next) => {
    try {
        const body = req.body;
        const actorRoles = getActorRoles(req.user?.roles);
        const park = await geo_service_1.adminGeoService.createPark({ actorId: req.user?.sub, roles: actorRoles }, body, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(201).json({ park });
    }
    catch (error) {
        next(error);
    }
});
exports.adminParksRouter = router;
//# sourceMappingURL=admin-parks.routes.js.map