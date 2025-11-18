"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAdminExpeditionStatusSchema = exports.updateAdminExpeditionSchema = exports.getAdminExpeditionSchema = exports.createAdminExpeditionSchema = exports.listAdminExpeditionsSchema = exports.EXPEDITION_STATUS_VALUES = void 0;
const zod_1 = require("zod");
exports.EXPEDITION_STATUS_VALUES = [
    'DRAFT',
    'PUBLISHED',
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
];
const priceValueSchema = zod_1.z
    .union([zod_1.z.number(), zod_1.z.string()])
    .transform((value, ctx) => {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'pricePerPerson must be a finite number',
            });
            return zod_1.z.NEVER;
        }
        return value;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'pricePerPerson cannot be empty',
        });
        return zod_1.z.NEVER;
    }
    const normalized = trimmed.replace(',', '.');
    const numeric = Number.parseFloat(normalized);
    if (!Number.isFinite(numeric)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'pricePerPerson must be a valid number',
        });
        return zod_1.z.NEVER;
    }
    return numeric;
})
    .refine((value) => value >= 0, {
    message: 'pricePerPerson must be greater than or equal to zero',
});
const optionalText = (max) => zod_1.z
    .union([zod_1.z.string().trim().max(max), zod_1.z.literal(null)])
    .optional();
const optionalGuideId = zod_1.z.union([zod_1.z.string().uuid(), zod_1.z.literal(null)]).optional();
exports.listAdminExpeditionsSchema = {
    query: zod_1.z.object({
        status: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
        guideId: zod_1.z.string().uuid().optional(),
        trailId: zod_1.z.string().uuid().optional(),
        from: zod_1.z.coerce.date().optional(),
        to: zod_1.z.coerce.date().optional(),
        page: zod_1.z.coerce.number().int().min(1).optional(),
        pageSize: zod_1.z.coerce.number().int().min(1).max(100).optional(),
    }),
};
exports.createAdminExpeditionSchema = {
    body: zod_1.z
        .object({
        trailId: zod_1.z.string().uuid(),
        guideId: optionalGuideId,
        startDate: zod_1.z.coerce.date(),
        endDate: zod_1.z.coerce.date(),
        pricePerPerson: priceValueSchema.optional(),
        priceCents: zod_1.z.coerce.number().int().min(0).optional(),
        maxPeople: zod_1.z.coerce.number().int().min(1).max(1000),
        description: zod_1.z.string().trim().min(1).max(5000),
    })
        .superRefine((data, ctx) => {
        if (data.priceCents === undefined && data.pricePerPerson === undefined) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'pricePerPerson or priceCents must be provided',
                path: ['pricePerPerson'],
            });
        }
    }),
};
exports.getAdminExpeditionSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
};
exports.updateAdminExpeditionSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
    body: zod_1.z
        .object({
        trailId: zod_1.z.string().uuid().optional(),
        guideId: optionalGuideId,
        startDate: zod_1.z.coerce.date().optional(),
        endDate: zod_1.z.coerce.date().optional(),
        pricePerPerson: priceValueSchema.optional(),
        priceCents: zod_1.z.coerce.number().int().min(0).optional(),
        maxPeople: zod_1.z.coerce.number().int().min(1).max(1000).optional(),
        description: optionalText(5000),
    })
        .refine((data) => {
        if (data.pricePerPerson === undefined && data.priceCents === undefined) {
            return true;
        }
        if (data.priceCents !== undefined) {
            return true;
        }
        return data.pricePerPerson !== undefined;
    }, {
        message: 'pricePerPerson or priceCents must be provided when updating price',
        path: ['pricePerPerson'],
    }),
};
exports.updateAdminExpeditionStatusSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
    body: zod_1.z.object({
        status: zod_1.z.enum(exports.EXPEDITION_STATUS_VALUES),
        reason: zod_1.z.string().trim().max(2000).optional(),
    }),
};
//# sourceMappingURL=expedition.schemas.js.map