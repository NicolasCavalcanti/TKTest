"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPublicExpeditionsSchema = exports.listPublicTrailsSchema = exports.listPublicCitiesSchema = void 0;
const zod_1 = require("zod");
const optionalTrimmedString = zod_1.z
    .union([zod_1.z.string(), zod_1.z.undefined()])
    .transform((value) => {
    if (value === undefined) {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
});
const optionalDate = zod_1.z
    .union([zod_1.z.string(), zod_1.z.date(), zod_1.z.undefined()])
    .transform((value, ctx) => {
    if (value === undefined) {
        return undefined;
    }
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: 'Invalid date format' });
            return zod_1.z.NEVER;
        }
        return value;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return undefined;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: 'Invalid date format' });
        return zod_1.z.NEVER;
    }
    return parsed;
});
exports.listPublicCitiesSchema = {
    query: zod_1.z.object({
        state: optionalTrimmedString,
        search: optionalTrimmedString,
        page: zod_1.z.coerce.number().int().min(1).optional(),
        pageSize: zod_1.z.coerce.number().int().min(1).max(100).optional(),
        sort: optionalTrimmedString,
    }),
};
exports.listPublicTrailsSchema = {
    query: zod_1.z.object({
        state: optionalTrimmedString,
        city: optionalTrimmedString,
        search: optionalTrimmedString,
        page: zod_1.z.coerce.number().int().min(1).optional(),
        pageSize: zod_1.z.coerce.number().int().min(1).max(100).optional(),
        sort: optionalTrimmedString,
    }),
};
exports.listPublicExpeditionsSchema = {
    query: zod_1.z.object({
        trailId: optionalTrimmedString,
        dateFrom: optionalDate,
        dateTo: optionalDate,
        search: optionalTrimmedString,
        page: zod_1.z.coerce.number().int().min(1).optional(),
        pageSize: zod_1.z.coerce.number().int().min(1).max(100).optional(),
        sort: optionalTrimmedString,
    }),
};
//# sourceMappingURL=public.schemas.js.map