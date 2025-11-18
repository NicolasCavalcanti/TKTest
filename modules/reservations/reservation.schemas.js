"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAdminReservationSchema = exports.createAdminReservationSchema = exports.listAdminReservationsSchema = exports.RESERVATION_STATUS_VALUES = void 0;
const zod_1 = require("zod");
exports.RESERVATION_STATUS_VALUES = [
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'WAITLISTED',
    'EXPIRED',
];
const statusSchema = zod_1.z
    .union([
    zod_1.z.enum(exports.RESERVATION_STATUS_VALUES),
    zod_1.z
        .string()
        .trim()
        .transform((value, ctx) => {
        const upper = value.toUpperCase();
        if (!exports.RESERVATION_STATUS_VALUES.includes(upper)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: `Invalid reservation status: ${value}`,
            });
            return zod_1.z.NEVER;
        }
        return upper;
    }),
])
    .optional();
const optionalText = (max) => zod_1.z
    .union([zod_1.z.string().trim().max(max), zod_1.z.literal(null)])
    .optional();
exports.listAdminReservationsSchema = {
    query: zod_1.z.object({
        status: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
        expeditionId: zod_1.z.string().uuid().optional(),
        userId: zod_1.z.string().uuid().optional(),
        page: zod_1.z.coerce.number().int().min(1).optional(),
        pageSize: zod_1.z.coerce.number().int().min(1).max(100).optional(),
    }),
};
exports.createAdminReservationSchema = {
    body: zod_1.z.object({
        expeditionId: zod_1.z.string().uuid(),
        userId: zod_1.z.string().uuid(),
        headcount: zod_1.z.coerce.number().int().min(1).max(100).default(1),
        status: statusSchema,
        notes: optionalText(5000),
        internalNotes: optionalText(5000),
        emergencyContactName: optionalText(200),
        emergencyContactPhone: optionalText(50),
        feeCents: zod_1.z.coerce.number().int().min(0).optional(),
        discountCents: zod_1.z.coerce.number().int().min(0).optional(),
    }),
};
exports.updateAdminReservationSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
    body: zod_1.z
        .object({
        headcount: zod_1.z.coerce.number().int().min(1).max(100).optional(),
        status: statusSchema,
        notes: optionalText(5000),
        internalNotes: optionalText(5000),
        emergencyContactName: optionalText(200),
        emergencyContactPhone: optionalText(50),
        cancellationReason: optionalText(2000),
    })
        .refine((data) => {
        return (data.headcount !== undefined ||
            data.status !== undefined ||
            data.notes !== undefined ||
            data.internalNotes !== undefined ||
            data.emergencyContactName !== undefined ||
            data.emergencyContactPhone !== undefined ||
            data.cancellationReason !== undefined);
    }, {
        message: 'At least one field must be provided to update the reservation',
    }),
};
//# sourceMappingURL=reservation.schemas.js.map