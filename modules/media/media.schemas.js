"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMediaSchema = exports.createTrailMediaSchema = void 0;
const zod_1 = require("zod");
const optionalInteger = zod_1.z
    .union([zod_1.z.number(), zod_1.z.string(), zod_1.z.null(), zod_1.z.undefined()])
    .transform((value, ctx) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    const parseNumeric = (input) => {
        if (typeof input === 'number') {
            return input;
        }
        const trimmed = input.trim();
        if (trimmed.length === 0) {
            return Number.NaN;
        }
        if (!/^[-+]?\d+$/.test(trimmed)) {
            return Number.NaN;
        }
        return Number.parseInt(trimmed, 10);
    };
    const numeric = parseNumeric(value);
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: 'Value must be an integer' });
        return zod_1.z.NEVER;
    }
    if (numeric < 0) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: 'Value must be greater than or equal to zero' });
        return zod_1.z.NEVER;
    }
    return numeric;
});
exports.createTrailMediaSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
    body: zod_1.z
        .object({
        contentType: zod_1.z.string().trim().min(1),
        fileName: zod_1.z.string().trim().min(1).max(255).optional(),
        size: optionalInteger.optional(),
        title: zod_1.z.string().trim().min(1).max(200).optional(),
        description: zod_1.z.string().trim().min(1).max(2000).optional(),
    })
        .strict(),
};
exports.deleteMediaSchema = {
    params: zod_1.z.object({
        mediaId: zod_1.z.string().uuid(),
    }),
};
//# sourceMappingURL=media.schemas.js.map