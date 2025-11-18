"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createParkSchema = exports.listParksSchema = exports.createCitySchema = exports.listCitiesSchema = exports.createStateSchema = exports.listStatesSchema = exports.REGION_VALUES = void 0;
const zod_1 = require("zod");
exports.REGION_VALUES = ['NORTH', 'NORTHEAST', 'CENTRAL_WEST', 'SOUTHEAST', 'SOUTH'];
const nameSchema = zod_1.z
    .string()
    .trim()
    .min(1, { message: 'Name is required' })
    .max(255, { message: 'Name must be at most 255 characters long' });
const searchSchema = zod_1.z
    .string()
    .trim()
    .min(1, { message: 'Search term must contain at least 1 character' })
    .max(255, { message: 'Search term must be at most 255 characters long' });
const slugInputSchema = zod_1.z
    .string()
    .trim()
    .min(1, { message: 'Slug is required when provided' })
    .max(255, { message: 'Slug must be at most 255 characters long' });
const ufSchema = zod_1.z
    .string()
    .trim()
    .length(2, { message: 'State code must have exactly 2 characters' })
    .regex(/^[a-zA-Z]{2}$/u, { message: 'State code must contain only letters' })
    .transform((value) => value.toUpperCase());
const latitudeSchema = zod_1.z.coerce
    .number()
    .min(-90, { message: 'Latitude must be greater than or equal to -90' })
    .max(90, { message: 'Latitude must be less than or equal to 90' });
const longitudeSchema = zod_1.z.coerce
    .number()
    .min(-180, { message: 'Longitude must be greater than or equal to -180' })
    .max(180, { message: 'Longitude must be less than or equal to 180' });
exports.listStatesSchema = {
    query: zod_1.z
        .object({
        search: searchSchema.optional(),
        region: zod_1.z.enum(exports.REGION_VALUES).optional(),
    })
        .strict(),
};
exports.createStateSchema = {
    body: zod_1.z
        .object({
        code: ufSchema,
        name: nameSchema,
        region: zod_1.z.enum(exports.REGION_VALUES),
    })
        .strict(),
};
exports.listCitiesSchema = {
    query: zod_1.z
        .object({
        state: ufSchema.optional(),
        search: searchSchema.optional(),
    })
        .strict(),
};
exports.createCitySchema = {
    body: zod_1.z
        .object({
        stateId: zod_1.z.coerce.number().int().positive(),
        name: nameSchema,
        slug: slugInputSchema.optional(),
        isCapital: zod_1.z.boolean().optional(),
        latitude: latitudeSchema.optional(),
        longitude: longitudeSchema.optional(),
    })
        .strict()
        .superRefine((data, ctx) => {
        if ((data.latitude !== undefined && data.longitude === undefined) || (data.latitude === undefined && data.longitude !== undefined)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Latitude and longitude must be provided together',
                path: data.latitude === undefined ? ['latitude'] : ['longitude'],
            });
        }
    }),
};
exports.listParksSchema = {
    query: zod_1.z
        .object({
        cityId: zod_1.z.coerce.number().int().positive().optional(),
        search: searchSchema.optional(),
    })
        .strict(),
};
exports.createParkSchema = {
    body: zod_1.z
        .object({
        cityId: zod_1.z.coerce.number().int().positive(),
        name: nameSchema,
        slug: slugInputSchema.optional(),
        description: zod_1.z
            .string()
            .trim()
            .min(1, { message: 'Description must not be empty when provided' })
            .max(1000, { message: 'Description must be at most 1000 characters long' })
            .optional(),
    })
        .strict(),
};
//# sourceMappingURL=geo.schemas.js.map