"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminCitiesRouter = void 0;
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
router.get('/', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), (0, validation_1.validate)(geo_schemas_1.listCitiesSchema), async (req, res, next) => {
    try {
        const query = req.query;
        const cities = await geo_service_1.adminGeoService.listCities(query);
        res.status(200).json({ cities });
    }
    catch (error) {
        next(error);
    }
});
router.post('/', (0, rbac_1.requireRole)('ADMIN', 'EDITOR'), (0, validation_1.validate)(geo_schemas_1.createCitySchema), async (req, res, next) => {
    try {
        const body = req.body;
        const actorRoles = getActorRoles(req.user?.roles);
        const city = await geo_service_1.adminGeoService.createCity({ actorId: req.user?.sub, roles: actorRoles }, body, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(201).json({ city });
    }
    catch (error) {
        next(error);
    }
});
exports.adminCitiesRouter = router;
//# sourceMappingURL=admin-cities.routes.js.map