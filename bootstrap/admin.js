"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDefaultAdmins = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("@prisma/client");
const prisma_1 = require("../services/prisma");
const DEFAULT_FALLBACK_PASSWORD = 'TrekkoAdmin@2025';
const DEFAULT_FALLBACK_HASH = '$2b$12$ox6szM42UDIjX4seJmQegezt0IOLo/.m6Yn0vLDZKvLfvcnhik8B2';
const isBcryptHash = (value) => {
    return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
};
const ADMIN_USERS = [
    {
        email: 'contato@trekko.com.br',
        name: 'Equipe Trekko',
        passwordEnv: 'TREKKO_ADMIN_CONTATO_PASSWORD',
        passwordHashEnv: 'TREKKO_ADMIN_CONTATO_PASSWORD_HASH',
        fallbackHash: DEFAULT_FALLBACK_HASH,
        fallbackPassword: DEFAULT_FALLBACK_PASSWORD,
    },
];
const resolvePasswordHash = async (config) => {
    const hashedFromEnv = config.passwordHashEnv
        ? (process.env[config.passwordHashEnv] ?? '').trim()
        : '';
    if (hashedFromEnv.length > 0) {
        if (!isBcryptHash(hashedFromEnv)) {
            throw new Error(`Environment variable ${config.passwordHashEnv} must contain a bcrypt hash.`);
        }
        return { hash: hashedFromEnv };
    }
    const passwordFromEnv = config.passwordEnv
        ? (process.env[config.passwordEnv] ?? '').trim()
        : '';
    if (passwordFromEnv.length > 0) {
        const hash = await bcrypt_1.default.hash(passwordFromEnv, 12);
        return { hash };
    }
    return {
        hash: config.fallbackHash ?? DEFAULT_FALLBACK_HASH,
        note: config.fallbackPassword ?? DEFAULT_FALLBACK_PASSWORD,
    };
};
const ensureAdminUser = async (config) => {
    const existing = await prisma_1.prisma.user.findUnique({ where: { email: config.email } });
    if (!existing) {
        const { hash, note } = await resolvePasswordHash(config);
        await prisma_1.prisma.user.create({
            data: {
                email: config.email,
                name: config.name ?? null,
                role: 'ADMIN',
                status: client_1.UserStatus.ACTIVE,
                passwordHash: hash,
            },
        });
        if (note) {
            console.info(`Administrador padrão criado para ${config.email}. ` +
                `Utilize a senha temporária "${note}" e altere-a imediatamente.`);
        }
        else {
            console.info(`Administrador padrão criado para ${config.email}.`);
        }
        return;
    }
    const updateData = {};
    const normalizedRole = existing.role?.trim().toUpperCase();
    if (normalizedRole !== 'ADMIN') {
        updateData.role = 'ADMIN';
    }
    if (existing.status !== client_1.UserStatus.ACTIVE) {
        updateData.status = client_1.UserStatus.ACTIVE;
        updateData.deletedAt = null;
    }
    else if (existing.deletedAt) {
        updateData.deletedAt = null;
    }
    if (config.name && existing.name !== config.name) {
        updateData.name = config.name;
    }
    if (Object.keys(updateData).length > 0) {
        await prisma_1.prisma.user.update({
            where: { id: existing.id },
            data: updateData,
        });
        console.info(`Administrador ${config.email} atualizado com permissões elevadas.`);
    }
};
const ensureDefaultAdmins = async () => {
    for (const admin of ADMIN_USERS) {
        try {
            await ensureAdminUser(admin);
        }
        catch (error) {
            console.error(`Falha ao garantir administrador ${admin.email}:`, error);
        }
    }
};
exports.ensureDefaultAdmins = ensureDefaultAdmins;
//# sourceMappingURL=admin.js.map