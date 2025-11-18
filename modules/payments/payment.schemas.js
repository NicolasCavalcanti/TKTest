"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refundAdminPaymentSchema = exports.captureAdminPaymentSchema = exports.listAdminPaymentsSchema = exports.PAYMENT_METHOD_VALUES = exports.PAYMENT_PROVIDER_VALUES = exports.PAYMENT_STATUS_VALUES = void 0;
const zod_1 = require("zod");
exports.PAYMENT_STATUS_VALUES = [
    'PENDING',
    'AUTHORIZED',
    'PAID',
    'REFUNDED',
    'FAILED',
    'CANCELLED',
    'CHARGEBACK',
];
exports.PAYMENT_PROVIDER_VALUES = ['MERCADO_PAGO', 'STRIPE', 'MANUAL'];
exports.PAYMENT_METHOD_VALUES = [
    'PIX',
    'CREDIT_CARD',
    'BOLETO',
    'BANK_TRANSFER',
    'CASH',
    'OTHER',
];
const normalizeStatus = (value, ctx) => {
    const upper = value.trim().toUpperCase();
    if (!exports.PAYMENT_STATUS_VALUES.includes(upper)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `Invalid payment status: ${value}`,
        });
        return zod_1.z.NEVER;
    }
    return upper;
};
const parseStatusFilter = (value, ctx) => {
    const values = Array.isArray(value) ? value : value.split(',');
    const normalized = [];
    for (const entry of values) {
        const trimmed = entry.trim();
        if (trimmed.length === 0) {
            continue;
        }
        normalized.push(normalizeStatus(trimmed, ctx));
    }
    return normalized;
};
const providerSchema = zod_1.z
    .union([
    zod_1.z.enum(exports.PAYMENT_PROVIDER_VALUES),
    zod_1.z
        .string()
        .trim()
        .transform((value, ctx) => {
        const upper = value.toUpperCase();
        if (!exports.PAYMENT_PROVIDER_VALUES.includes(upper)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: `Invalid payment provider: ${value}`,
            });
            return zod_1.z.NEVER;
        }
        return upper;
    }),
])
    .optional();
const methodSchema = zod_1.z
    .union([
    zod_1.z.enum(exports.PAYMENT_METHOD_VALUES),
    zod_1.z
        .string()
        .trim()
        .transform((value, ctx) => {
        const upper = value.toUpperCase();
        if (!exports.PAYMENT_METHOD_VALUES.includes(upper)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: `Invalid payment method: ${value}`,
            });
            return zod_1.z.NEVER;
        }
        return upper;
    }),
])
    .optional();
exports.listAdminPaymentsSchema = {
    query: zod_1.z
        .object({
        status: zod_1.z
            .union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())])
            .transform((value, ctx) => parseStatusFilter(value, ctx))
            .optional(),
    })
        .transform((value) => {
        return {
            status: value.status && value.status.length > 0 ? value.status : undefined,
        };
    }),
};
exports.captureAdminPaymentSchema = {
    params: zod_1.z.object({
        reservationId: zod_1.z.string().uuid(),
    }),
    body: zod_1.z.object({
        provider: providerSchema,
        method: methodSchema,
        metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    }),
};
exports.refundAdminPaymentSchema = {
    params: zod_1.z.object({
        reservationId: zod_1.z.string().uuid(),
    }),
    body: zod_1.z.object({
        amountCents: zod_1.z.coerce.number().int().min(1).optional(),
        reason: zod_1.z
            .union([zod_1.z.string().trim().max(500), zod_1.z.literal(null)])
            .optional(),
        metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    }),
};
//# sourceMappingURL=payment.schemas.js.map