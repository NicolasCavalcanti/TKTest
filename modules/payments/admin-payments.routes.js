"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminPaymentsRouter = void 0;
const express_1 = require("express");
const rbac_1 = require("../../middlewares/rbac");
const validation_1 = require("../../middlewares/validation");
const payment_service_1 = require("./payment.service");
const payment_schemas_1 = require("./payment.schemas");
const router = (0, express_1.Router)();
const extractRoles = (roles) => {
    if (!Array.isArray(roles)) {
        return [];
    }
    return roles
        .map((role) => (typeof role === 'string' ? role.trim() : ''))
        .filter((role) => role.length > 0);
};
router.get('/', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), (0, validation_1.validate)(payment_schemas_1.listAdminPaymentsSchema), async (req, res, next) => {
    try {
        const query = req.query;
        const payments = await payment_service_1.adminPaymentService.listPayments(query);
        res.status(200).json({ payments });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:reservationId/capture', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), (0, validation_1.validate)(payment_schemas_1.captureAdminPaymentSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const body = req.body;
        const actorRoles = extractRoles(req.user?.roles);
        const payment = await payment_service_1.adminPaymentService.capturePayment({ actorId: req.user?.sub, roles: actorRoles }, params, body, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(200).json({ payment });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:reservationId/refund', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), (0, validation_1.validate)(payment_schemas_1.refundAdminPaymentSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const body = req.body;
        const actorRoles = extractRoles(req.user?.roles);
        const payment = await payment_service_1.adminPaymentService.refundPayment({ actorId: req.user?.sub, roles: actorRoles }, params, body, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(200).json({ payment });
    }
    catch (error) {
        next(error);
    }
});
exports.adminPaymentsRouter = router;
//# sourceMappingURL=admin-payments.routes.js.map