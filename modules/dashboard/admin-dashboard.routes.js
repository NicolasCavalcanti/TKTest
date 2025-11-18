"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminDashboardRouter = void 0;
const express_1 = require("express");
const rbac_1 = require("../../middlewares/rbac");
const dashboard_service_1 = require("./dashboard.service");
const router = (0, express_1.Router)();
const parseLimit = (value, fallback) => {
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
            return parsed;
        }
    }
    if (Array.isArray(value) && value.length > 0) {
        return parseLimit(value[0], fallback);
    }
    return fallback;
};
router.get('/metrics', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), async (_req, res, next) => {
    try {
        const metrics = await dashboard_service_1.adminDashboardService.getMetrics();
        res.status(200).json({ metrics });
    }
    catch (error) {
        next(error);
    }
});
router.get('/events', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), async (req, res, next) => {
    try {
        const limit = parseLimit(req.query.limit, 20);
        const events = await dashboard_service_1.adminDashboardService.getRecentEvents(limit);
        res.status(200).json({ events });
    }
    catch (error) {
        next(error);
    }
});
exports.adminDashboardRouter = router;
//# sourceMappingURL=admin-dashboard.routes.js.map