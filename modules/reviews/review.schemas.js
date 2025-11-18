"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewStatusValues = exports.deleteAdminReviewSchema = exports.listAdminReviewsSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const optionalTrimmedString = zod_1.z
    .union([zod_1.z.string(), zod_1.z.undefined()])
    .transform((value) => {
    if (value === undefined) {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
});
const ratingSchema = zod_1.z
    .union([zod_1.z.string(), zod_1.z.number(), zod_1.z.undefined()])
    .transform((value, ctx) => {
    if (value === undefined) {
        return undefined;
    }
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Rating must be an integer between 1 and 5',
        });
        return zod_1.z.NEVER;
    }
    if (numeric < 1 || numeric > 5) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Rating must be between 1 and 5',
        });
        return zod_1.z.NEVER;
    }
    return numeric;
});
const statusSchema = zod_1.z
    .union([zod_1.z.string(), zod_1.z.array(zod_1.z.string()), zod_1.z.undefined()])
    .transform((value) => {
    if (value === undefined) {
        return undefined;
    }
    const toStatus = (input) => input.trim().toUpperCase();
    if (Array.isArray(value)) {
        const result = value
            .map((item) => toStatus(item))
            .filter((item) => item.length > 0);
        return result.length > 0 ? result : undefined;
    }
    const single = toStatus(value);
    return single.length > 0 ? [single] : undefined;
});
exports.listAdminReviewsSchema = {
    query: zod_1.z.object({
        page: zod_1.z.coerce.number().int().min(1).optional(),
        pageSize: zod_1.z.coerce.number().int().min(1).max(100).optional(),
        guideId: optionalTrimmedString,
        trailId: optionalTrimmedString,
        expeditionId: optionalTrimmedString,
        reservationId: optionalTrimmedString,
        rating: ratingSchema,
        status: statusSchema,
        search: optionalTrimmedString,
        sort: optionalTrimmedString,
    }),
};
exports.deleteAdminReviewSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().trim().min(1),
    }),
};
exports.reviewStatusValues = Object.values(client_1.ReviewStatus);
//# sourceMappingURL=review.schemas.js.map