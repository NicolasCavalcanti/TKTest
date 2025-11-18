"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAdminTrailSchema = exports.updateAdminTrailSchema = exports.getAdminTrailSchema = exports.createAdminTrailSchema = exports.listAdminTrailsSchema = exports.TRAIL_DIFFICULTY_VALUES = void 0;
const zod_1 = require("zod");
exports.TRAIL_DIFFICULTY_VALUES = ['EASY', 'MODERATE', 'HARD', 'EXTREME'];
const trailDifficultyEnum = zod_1.z.enum(exports.TRAIL_DIFFICULTY_VALUES);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const optionalText = (max) => zod_1.z
    .union([zod_1.z.string().trim().max(max), zod_1.z.literal(null)])
    .optional();
const createOptionalNumberSchema = (options) => zod_1.z
    .union([zod_1.z.number(), zod_1.z.string(), zod_1.z.null(), zod_1.z.undefined()])
    .transform((value, ctx) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    let numeric;
    if (typeof value === 'number') {
        numeric = value;
    }
    else {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            return null;
        }
        numeric = Number(trimmed);
    }
    if (!Number.isFinite(numeric)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `${options.fieldName} must be a valid number`,
        });
        return zod_1.z.NEVER;
    }
    if (!options.allowDecimal && !Number.isInteger(numeric)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `${options.fieldName} must be an integer`,
        });
        return zod_1.z.NEVER;
    }
    if (options.min !== undefined && numeric < options.min) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `${options.fieldName} must be greater than or equal to ${options.min}`,
        });
        return zod_1.z.NEVER;
    }
    if (options.max !== undefined && numeric > options.max) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `${options.fieldName} must be less than or equal to ${options.max}`,
        });
        return zod_1.z.NEVER;
    }
    return numeric;
});
const optionalPositiveIntId = zod_1.z
    .union([zod_1.z.number(), zod_1.z.string(), zod_1.z.null(), zod_1.z.undefined()])
    .transform((value, ctx) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    const toInteger = (input) => {
        if (typeof input === 'number') {
            return input;
        }
        const trimmed = input.trim();
        if (trimmed.length === 0) {
            return Number.NaN;
        }
        if (!/^\d+$/.test(trimmed)) {
            return Number.NaN;
        }
        return Number.parseInt(trimmed, 10);
    };
    const numeric = toInteger(value);
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: 'Identifier must be an integer' });
        return zod_1.z.NEVER;
    }
    if (numeric <= 0) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: 'Identifier must be greater than zero' });
        return zod_1.z.NEVER;
    }
    return numeric;
});
const distanceKmSchema = createOptionalNumberSchema({
    fieldName: 'distanceKm',
    allowDecimal: true,
    min: 0,
});
const durationMinutesSchema = createOptionalNumberSchema({
    fieldName: 'durationMinutes',
    allowDecimal: false,
    min: 0,
});
const elevationSchema = createOptionalNumberSchema({
    fieldName: 'elevation',
    allowDecimal: false,
});
const altitudeSchema = createOptionalNumberSchema({
    fieldName: 'altitude',
    allowDecimal: false,
});
const centsSchema = createOptionalNumberSchema({
    fieldName: 'value',
    allowDecimal: false,
    min: 0,
});
const booleanWithDefault = (defaultValue) => zod_1.z.boolean().optional().default(defaultValue);
exports.listAdminTrailsSchema = {
    query: zod_1.z.object({
        page: zod_1.z.coerce.number().int().min(1).optional(),
        pageSize: zod_1.z.coerce.number().int().min(1).max(100).optional(),
        state: zod_1.z.union([zod_1.z.string().trim(), zod_1.z.number()]).optional(),
        city: zod_1.z.union([zod_1.z.string().trim(), zod_1.z.number()]).optional(),
        difficulty: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
        search: zod_1.z.string().trim().optional(),
        sort: zod_1.z.string().trim().optional(),
    }),
};
exports.createAdminTrailSchema = {
    body: zod_1.z
        .object({
        name: zod_1.z.string().trim().min(1).max(200),
        slug: zod_1.z
            .string()
            .trim()
            .min(1)
            .max(150)
            .regex(slugPattern, 'Slug must contain only lowercase letters, numbers, and hyphens'),
        summary: optionalText(500),
        description: optionalText(5000),
        difficulty: trailDifficultyEnum.optional().default('MODERATE'),
        distanceKm: distanceKmSchema.optional(),
        durationMinutes: durationMinutesSchema.optional(),
        elevationGain: elevationSchema.optional(),
        elevationLoss: elevationSchema.optional(),
        maxAltitude: altitudeSchema.optional(),
        minAltitude: altitudeSchema.optional(),
        stateId: optionalPositiveIntId.optional(),
        cityId: optionalPositiveIntId.optional(),
        hasWaterPoints: booleanWithDefault(false),
        hasCamping: booleanWithDefault(false),
        paidEntry: booleanWithDefault(false),
        entryFeeCents: centsSchema.optional(),
        guideFeeCents: centsSchema.optional(),
        meetingPoint: optionalText(500),
        notes: optionalText(5000),
    })
        .strict(),
};
exports.getAdminTrailSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
};
exports.updateAdminTrailSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
    body: zod_1.z
        .object({
        name: zod_1.z.string().trim().min(1).max(200).optional(),
        slug: zod_1.z
            .string()
            .trim()
            .min(1)
            .max(150)
            .regex(slugPattern, 'Slug must contain only lowercase letters, numbers, and hyphens')
            .optional(),
        summary: optionalText(500),
        description: optionalText(5000),
        difficulty: trailDifficultyEnum.optional(),
        distanceKm: distanceKmSchema.optional(),
        durationMinutes: durationMinutesSchema.optional(),
        elevationGain: elevationSchema.optional(),
        elevationLoss: elevationSchema.optional(),
        maxAltitude: altitudeSchema.optional(),
        minAltitude: altitudeSchema.optional(),
        stateId: optionalPositiveIntId.optional(),
        cityId: optionalPositiveIntId.optional(),
        hasWaterPoints: zod_1.z.boolean().optional(),
        hasCamping: zod_1.z.boolean().optional(),
        paidEntry: zod_1.z.boolean().optional(),
        entryFeeCents: centsSchema.optional(),
        guideFeeCents: centsSchema.optional(),
        meetingPoint: optionalText(500),
        notes: optionalText(5000),
    })
        .strict(),
};
exports.deleteAdminTrailSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
};
//# sourceMappingURL=trail.schemas.js.map