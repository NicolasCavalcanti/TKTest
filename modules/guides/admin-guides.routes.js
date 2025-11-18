"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminGuidesRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const error_1 = require("../../middlewares/error");
const rate_limit_1 = require("../../middlewares/rate-limit");
const rbac_1 = require("../../middlewares/rbac");
const validation_1 = require("../../middlewares/validation");
const guide_service_1 = require("./guide.service");
const guide_schemas_1 = require("./guide.schemas");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const importCadasturRateLimiter = (0, rate_limit_1.rateLimit)({ windowMs: 5 * 60_000, max: 5 });
const getActorRoles = (roles) => {
    if (!Array.isArray(roles)) {
        return [];
    }
    return roles
        .map((role) => (typeof role === 'string' ? role.trim() : ''))
        .filter((role) => role.length > 0);
};
const parseBooleanFlag = (value) => {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === '1' || normalized === 'true';
    }
    if (typeof value === 'number') {
        return value === 1;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    return false;
};
router.get('/', (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), (0, validation_1.validate)(guide_schemas_1.listAdminGuidesSchema), async (req, res, next) => {
    try {
        const query = req.query;
        const result = await guide_service_1.adminGuideService.listGuides({
            page: query.page,
            pageSize: query.pageSize,
            search: query.search,
            verification: query.verification,
            sort: query.sort,
        });
        res.status(200).json(result);
    }
    catch (error) {
        next(error);
    }
});
router.post('/import-cadastur', importCadasturRateLimiter, (0, rbac_1.requireRole)('ADMIN', 'EDITOR', 'OPERADOR'), upload.single('file'), async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            throw new error_1.HttpError(400, 'FILE_REQUIRED', 'Arquivo CSV é obrigatório');
        }
        const confirm = parseBooleanFlag(req.body?.confirm);
        if (confirm) {
            const actorRoles = getActorRoles(req.user?.roles);
            const result = await guide_service_1.adminGuideService.importCadasturFromCsv({ actorId: req.user?.sub, roles: actorRoles }, file.buffer, file.originalname, { ip: req.ip, userAgent: req.get('user-agent') });
            res.status(200).json(result);
            return;
        }
        const preview = await guide_service_1.adminGuideService.previewCadasturImport(file.buffer);
        res.status(200).json(preview);
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:id/verify', (0, rbac_1.requireRole)('ADMIN', 'EDITOR'), (0, validation_1.validate)(guide_schemas_1.verifyGuideSchema), async (req, res, next) => {
    try {
        const params = req.params;
        const body = req.body;
        const actorRoles = getActorRoles(req.user?.roles);
        const guide = await guide_service_1.adminGuideService.verifyGuide({ actorId: req.user?.sub, roles: actorRoles }, params.id, body.status, body.notes, { ip: req.ip, userAgent: req.get('user-agent') });
        res.status(200).json({ guide });
    }
    catch (error) {
        next(error);
    }
});
exports.adminGuidesRouter = router;
//# sourceMappingURL=admin-guides.routes.js.map