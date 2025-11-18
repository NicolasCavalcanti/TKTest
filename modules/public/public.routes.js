"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicRouter = void 0;
const express_1 = require("express");
const validation_1 = require("../../middlewares/validation");
const public_schemas_1 = require("./public.schemas");
const public_service_1 = require("./public.service");
const router = (0, express_1.Router)();
router.get('/cities-with-trails', (0, validation_1.validate)(public_schemas_1.listPublicCitiesSchema), async (req, res, next) => {
    try {
        const query = req.query;
        const result = await public_service_1.publicContentService.listCitiesWithTrails(query);
        res.status(200).json(result);
    }
    catch (error) {
        next(error);
    }
});
router.get('/trails', (0, validation_1.validate)(public_schemas_1.listPublicTrailsSchema), async (req, res, next) => {
    try {
        const query = req.query;
        const result = await public_service_1.publicContentService.listTrails(query);
        res.status(200).json(result);
    }
    catch (error) {
        next(error);
    }
});
router.get('/expeditions', (0, validation_1.validate)(public_schemas_1.listPublicExpeditionsSchema), async (req, res, next) => {
    try {
        const query = req.query;
        const result = await public_service_1.publicContentService.listExpeditions(query);
        res.status(200).json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.publicRouter = router;
//# sourceMappingURL=public.routes.js.map