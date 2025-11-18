"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyGuideSchema = exports.listAdminGuidesSchema = exports.GUIDE_VERIFICATION_STATUS_VALUES = void 0;
const zod_1 = require("zod");
exports.GUIDE_VERIFICATION_STATUS_VALUES = ['PENDING', 'VERIFIED', 'REJECTED'];
const SORTABLE_FIELDS = [
    'createdAt',
    'updatedAt',
    'displayName',
    'verificationStatus',
    'verifiedAt',
    'rejectedAt',
    'cadasturNumber',
];
const normalizeSortField = (value) => {
    const sanitized = value.replace(/^[-+]/, '').trim();
    const normalized = sanitized.toLowerCase().replace(/_/g, '');
    const match = SORTABLE_FIELDS.find((field) => field.toLowerCase().replace(/_/g, '') === normalized);
    return match ?? '';
};
exports.listAdminGuidesSchema = {
    query: zod_1.z
        .object({
        page: zod_1.z.coerce.number().int().min(1).optional().default(1),
        pageSize: zod_1.z.coerce.number().int().min(1).max(100).optional().default(20),
        search: zod_1.z
            .string()
            .trim()
            .min(1)
            .max(255)
            .optional(),
        verification: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
        sort: zod_1.z
            .string()
            .trim()
            .refine((value) => {
            if (value.length === 0) {
                return true;
            }
            return normalizeSortField(value).length > 0;
        }, { message: 'Invalid sort field' })
            .optional(),
    })
        .strict(),
};
exports.verifyGuideSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
    body: zod_1.z.object({
        status: zod_1.z.enum(['VERIFIED', 'REJECTED']),
        notes: zod_1.z
            .string()
            .trim()
            .min(1)
            .max(500)
            .optional(),
    }),
};
//# sourceMappingURL=guide.schemas.js.map