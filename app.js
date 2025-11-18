"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.app = void 0;
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const node_crypto_1 = require("node:crypto");
const pino_1 = __importDefault(require("pino"));
const pino_http_1 = __importDefault(require("pino-http"));
const error_1 = require("./middlewares/error");
const request_id_1 = require("./middlewares/request-id");
const prisma_1 = require("./services/prisma");
const auth_routes_1 = require("./modules/auth/auth.routes");
const admin_routes_1 = require("./modules/admin/admin.routes");
const public_routes_1 = require("./modules/public/public.routes");
const csrf_1 = require("./middlewares/csrf");
const admin_1 = require("./bootstrap/admin");
const node_path_1 = __importDefault(require("node:path"));
const logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL ?? 'info',
});
exports.logger = logger;
const app = (0, express_1.default)();
exports.app = app;
void (0, admin_1.ensureDefaultAdmins)().catch((error) => {
    logger.error({ err: error }, 'Failed to ensure default admin users');
});
const corsOrigins = process.env.CORS_ORIGIN
    ?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(request_id_1.requestId);
const httpLoggerOptions = {
    logger,
    genReqId: (req, res) => {
        const requestScopedId = req.requestId;
        const responseScopedId = typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined;
        return requestScopedId ?? responseScopedId ?? (0, node_crypto_1.randomUUID)();
    },
    customSuccessMessage() {
        return 'request completed';
    },
    customErrorMessage() {
        return 'request errored';
    },
    customLogLevel(_req, res, error) {
        if (error)
            return 'error';
        if (res.statusCode >= 500)
            return 'error';
        if (res.statusCode >= 400)
            return 'warn';
        return 'info';
    },
    customProps(_req, res) {
        return {
            requestId: res.locals.requestId,
        };
    },
};
app.use((0, pino_http_1.default)(httpLoggerOptions));
app.use((0, cors_1.default)({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(csrf_1.csrfProtection);
// Servir arquivos estáticos do frontend
app.use(express_1.default.static(node_path_1.default.join(__dirname, '..')));
app.get('/api/healthz', async (_req, res, next) => {
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        res.status(200).json({
            status: 'ok',
            db: 'ok',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        next(new error_1.HttpError(503, 'DB_UNAVAILABLE', 'Database connection failed', error instanceof Error ? error.message : undefined));
    }
});
app.use('/api/auth', auth_routes_1.authRouter);
app.use('/api/admin', admin_routes_1.adminRouter);
app.use('/api/public', public_routes_1.publicRouter);
app.use(error_1.errorHandler);
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
if (process.env.NODE_ENV !== 'test') {
    app.listen(port, '0.0.0.0', () => {
        logger.info({ port }, 'API server listening');
    });
}
//# sourceMappingURL=app.js.map