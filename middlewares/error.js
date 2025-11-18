"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.HttpError = void 0;
const zod_1 = require("zod");
class HttpError extends Error {
    statusCode;
    code;
    details;
    constructor(statusCode, code, message, details) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}
exports.HttpError = HttpError;
const toErrorResponse = (error) => {
    const base = {
        code: error.code,
        message: error.message,
    };
    if (error.details === undefined) {
        return { error: base };
    }
    return {
        error: {
            ...base,
            details: error.details,
        },
    };
};
const errorHandler = (error, req, res, next) => {
    if (res.headersSent) {
        next(error);
        return;
    }
    const logger = req.log;
    if (error instanceof zod_1.ZodError) {
        const validationError = new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', error.issues);
        res.status(validationError.statusCode).json(toErrorResponse(validationError));
        return;
    }
    if (error instanceof HttpError) {
        if (error.statusCode >= 500) {
            logger?.error({ err: error, details: error.details }, 'Handled HttpError');
        }
        res.status(error.statusCode).json(toErrorResponse(error));
        return;
    }
    logger?.error({ err: error }, 'Unhandled error');
    const internalError = new HttpError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
    res.status(internalError.statusCode).json(toErrorResponse(internalError));
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error.js.map