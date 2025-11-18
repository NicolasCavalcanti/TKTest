"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminReservationsRouter = void 0;
const express_1 = require("express");
const rbac_1 = require("../../middlewares/rbac");
const validation_1 = require("../../middlewares/validation");
const reservation_service_1 = require("./reservation.service");
const reservation_schemas_1 = require("./reservation.schemas");
const router = (0, express_1.Router)();
const extractRoles = (roles) => {
    if (!Array.isArray(roles)) {
        return [];
    }
    return roles
        .map((role) => (typeof role === 'string' ? role.trim() : ''))
        .filter((role) => role.length > 0);
};
router.get('/', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), (0, validation_1.validate)(reservation_schemas_1.listAdminReservationsSchema), async (req, res, next) => {
    try {
        const query = req.query;
        const result = await reservation_service_1.adminReservationService.listReservations(query);
        res.status(200).json(result);
    }
    catch (error) {
        next(error);
    }
});
router.post('/', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), (0, validation_1.validate)(reservation_schemas_1.createAdminReservationSchema), async (req, res, next) => {
    try {
        const body = req.body;
        const actorRoles = extractRoles(req.user?.roles);
        const reservation = await reservation_service_1.adminReservationService.createReservation({ actorId: req.user?.sub, roles: actorRoles }, body, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(201).json({ reservation });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:id', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), (0, validation_1.validate)(reservation_schemas_1.updateAdminReservationSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const body = req.body;
        const actorRoles = extractRoles(req.user?.roles);
        const reservation = await reservation_service_1.adminReservationService.updateReservation({ actorId: req.user?.sub, roles: actorRoles }, params.id, body, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(200).json({ reservation });
    }
    catch (error) {
        next(error);
    }
});
exports.adminReservationsRouter = router;
//# sourceMappingURL=admin-reservations.routes.js.map