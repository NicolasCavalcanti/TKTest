"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAdminUserSchema = exports.updateAdminUserSchema = exports.getAdminUserSchema = exports.createAdminUserSchema = exports.listAdminUsersSchema = exports.USER_STATUS_VALUES = void 0;
const zod_1 = require("zod");
const admin_schemas_1 = require("../admin/admin.schemas");
exports.USER_STATUS_VALUES = ['ACTIVE', 'INACTIVE'];
const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'name', 'email', 'role', 'status'];
const normalizeSortField = (value) => {
    const sanitized = value.replace(/^[-+]/, '').trim();
    const normalized = sanitized.toLowerCase().replace(/_/g, '');
    const match = SORTABLE_FIELDS.find((field) => field.toLowerCase().replace(/_/g, '') === normalized);
    return match ?? '';
};
exports.listAdminUsersSchema = {
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
        role: zod_1.z
            .preprocess((value) => (typeof value === 'string' ? value.trim().toUpperCase() : value), zod_1.z.enum(admin_schemas_1.ADMIN_ROLE_VALUES).optional()),
        status: zod_1.z
            .preprocess((value) => (typeof value === 'string' ? value.trim().toUpperCase() : value), zod_1.z.enum(exports.USER_STATUS_VALUES).optional()),
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
exports.createAdminUserSchema = {
    body: zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(8),
        name: zod_1.z.string().min(1).optional(),
        role: zod_1.z.enum(admin_schemas_1.ADMIN_ROLE_VALUES),
    }),
};
exports.getAdminUserSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
};
exports.updateAdminUserSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
    body: zod_1.z
        .object({
        name: zod_1.z.string().min(1).optional(),
        role: zod_1.z.enum(admin_schemas_1.ADMIN_ROLE_VALUES).optional(),
        password: zod_1.z.string().min(8).optional(),
        status: zod_1.z.enum(exports.USER_STATUS_VALUES).optional(),
    })
        .superRefine((data, ctx) => {
        if (Object.keys(data).length === 0) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'At least one field must be provided',
            });
        }
    }),
};
exports.deleteAdminUserSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
};
//# sourceMappingURL=user.schemas.js.map