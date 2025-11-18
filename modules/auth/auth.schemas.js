"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCadasturSchema = exports.registerSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
const sanitizeEmail = (email) => email.trim().toLowerCase();
const sanitizeName = (name) => name.trim();
const sanitizeCadastur = (cadastur) => {
    if (!cadastur) {
        return undefined;
    }
    const digitsOnly = cadastur.replace(/\D/g, '');
    return digitsOnly.length > 0 ? digitsOnly : undefined;
};
exports.loginSchema = {
    body: zod_1.z.object({
        email: zod_1.z.string().email('E-mail inválido').transform(sanitizeEmail),
        password: zod_1.z.string().min(8, 'A senha deve conter pelo menos 8 caracteres').max(72),
    }),
};
const registerBodySchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1, 'Nome é obrigatório').transform(sanitizeName),
    email: zod_1.z.string().email('E-mail inválido').transform(sanitizeEmail),
    password: zod_1.z.string().min(8, 'A senha deve conter pelo menos 8 caracteres').max(72),
    user_type: zod_1.z.enum(['trekker', 'guia']).default('trekker'),
    cadastur_number: zod_1.z
        .string()
        .trim()
        .optional()
        .transform((value) => sanitizeCadastur(value ?? undefined)),
})
    .superRefine((data, ctx) => {
    if (data.user_type === 'guia') {
        if (!data.cadastur_number) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ['cadastur_number'],
                message: 'Número CADASTUR é obrigatório para guias',
            });
            return;
        }
        if (!/^\d{11}$/.test(data.cadastur_number)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ['cadastur_number'],
                message: 'Número CADASTUR deve conter 11 dígitos',
            });
        }
    }
});
exports.registerSchema = {
    body: registerBodySchema,
};
exports.validateCadasturSchema = {
    body: zod_1.z.object({
        name: zod_1.z.string().trim().min(1, 'Nome é obrigatório'),
        cadastur_number: zod_1.z.string().trim().min(1, 'Número CADASTUR é obrigatório'),
    }),
};
//# sourceMappingURL=auth.schemas.js.map