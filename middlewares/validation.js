"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
const error_1 = require("./error");
const validate = (schema) => {
    return (req, _res, next) => {
        try {
            if (schema.body) {
                req.body = schema.body.parse(req.body);
            }
            if (schema.params) {
                req.params = schema.params.parse(req.params);
            }
            if (schema.query) {
                req.query = schema.query.parse(req.query);
            }
            if (schema.headers) {
                req.headers = schema.headers.parse(req.headers);
            }
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                next(new error_1.HttpError(400, 'VALIDATION_ERROR', 'Validation failed', error.issues));
                return;
            }
            next(error);
            return;
        }
        next();
    };
};
exports.validate = validate;
//# sourceMappingURL=validation.js.map