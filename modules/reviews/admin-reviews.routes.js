"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminReviewsRouter = void 0;
const express_1 = require("express");
const rbac_1 = require("../../middlewares/rbac");
const validation_1 = require("../../middlewares/validation");
const review_schemas_1 = require("./review.schemas");
const review_service_1 = require("./review.service");
const router = (0, express_1.Router)();
const extractRoles = (roles) => {
    if (!Array.isArray(roles)) {
        return [];
    }
    return roles
        .map((role) => (typeof role === 'string' ? role.trim() : ''))
        .filter((role) => role.length > 0);
};
router.get('/', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), (0, validation_1.validate)(review_schemas_1.listAdminReviewsSchema), async (req, res, next) => {
    try {
        const query = req.query;
        const result = await review_service_1.adminReviewService.listReviews(query);
        res.status(200).json(result);
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', (0, rbac_1.requireRole)('ADMIN', 'EDITOR'), (0, validation_1.validate)(review_schemas_1.deleteAdminReviewSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const actorRoles = extractRoles(req.user?.roles);
        const actor = { actorId: req.user?.sub, roles: actorRoles };
        await review_service_1.adminReviewService.deleteReview(actor, params.id, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
exports.adminReviewsRouter = router;
//# sourceMappingURL=admin-reviews.routes.js.map