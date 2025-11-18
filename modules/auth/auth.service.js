"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = exports.REFRESH_TOKEN_EXPIRATION_SECONDS = exports.ACCESS_TOKEN_EXPIRATION_SECONDS = void 0;
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const error_1 = require("../../middlewares/error");
const prisma_1 = require("../../services/prisma");
exports.ACCESS_TOKEN_EXPIRATION_SECONDS = 15 * 60; // 15 minutes
exports.REFRESH_TOKEN_EXPIRATION_SECONDS = 7 * 24 * 60 * 60; // 7 days
const hashToken = (token) => {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
};
const toBasicProfile = (user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
});
const getAccessSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new error_1.HttpError(500, 'JWT_SECRET_NOT_CONFIGURED', 'JWT secret is not configured');
    }
    return secret;
};
const getRefreshSecret = () => {
    const secret = process.env.REFRESH_SECRET ?? process.env.JWT_SECRET;
    if (!secret) {
        throw new error_1.HttpError(500, 'REFRESH_SECRET_NOT_CONFIGURED', 'Refresh token secret is not configured');
    }
    return secret;
};
class AuthService {
    prismaClient;
    constructor(prismaClient = prisma_1.prisma) {
        this.prismaClient = prismaClient;
    }
    signAccessToken(user) {
        const payload = {
            sub: user.id,
            email: user.email,
            name: user.name ?? undefined,
            roles: [user.role],
            type: 'access',
        };
        return jsonwebtoken_1.default.sign(payload, getAccessSecret(), {
            expiresIn: exports.ACCESS_TOKEN_EXPIRATION_SECONDS,
        });
    }
    async createSession(userId) {
        const sessionId = (0, crypto_1.randomUUID)();
        const expiresAt = new Date(Date.now() + exports.REFRESH_TOKEN_EXPIRATION_SECONDS * 1000);
        const tokenHash = hashToken(sessionId);
        await this.prismaClient.authSession.create({
            data: {
                userId,
                tokenHash,
                expiresAt,
            },
        });
        const refreshPayload = {
            sub: userId,
            sid: sessionId,
            type: 'refresh',
        };
        const refreshToken = jsonwebtoken_1.default.sign(refreshPayload, getRefreshSecret(), {
            expiresIn: exports.REFRESH_TOKEN_EXPIRATION_SECONDS,
        });
        return refreshToken;
    }
    verifyRefreshToken(refreshToken) {
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshToken, getRefreshSecret());
            if (typeof decoded.sub !== 'string' || typeof decoded.sid !== 'string' || decoded.type !== 'refresh') {
                throw new Error('Invalid refresh token payload');
            }
            return decoded;
        }
        catch (error) {
            throw new error_1.HttpError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token', error instanceof Error ? error.message : undefined);
        }
    }
    async login(email, password) {
        const user = await this.prismaClient.user.findUnique({
            where: { email },
        });
        if (!user) {
            throw new error_1.HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
        }
        const isPasswordValid = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new error_1.HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
        }
        const accessToken = this.signAccessToken(user);
        const refreshToken = await this.createSession(user.id);
        return {
            user: toBasicProfile(user),
            accessToken,
            refreshToken,
        };
    }
    async register(params) {
        const normalizedEmail = params.email.trim().toLowerCase();
        const existingUser = await this.prismaClient.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (existingUser) {
            throw new error_1.HttpError(409, 'EMAIL_ALREADY_REGISTERED', 'Já existe um usuário cadastrado com este e-mail');
        }
        if (params.userType === 'guia' && params.cadasturNumber) {
            const existingGuideProfile = await this.prismaClient.guideProfile.findUnique({
                where: { cadasturNumber: params.cadasturNumber },
            });
            if (existingGuideProfile) {
                throw new error_1.HttpError(409, 'CADASTUR_ALREADY_REGISTERED', 'Este número CADASTUR já está vinculado a outra conta');
            }
        }
        const passwordHash = await bcrypt_1.default.hash(params.password, 12);
        const trimmedName = params.name.trim();
        const role = params.userType === 'guia' ? 'GUIA' : 'MEMBER';
        const user = await this.prismaClient.user.create({
            data: {
                email: normalizedEmail,
                passwordHash,
                name: trimmedName.length > 0 ? trimmedName : null,
                role,
                status: client_1.UserStatus.ACTIVE,
                guideProfile: params.userType === 'guia'
                    ? {
                        create: {
                            displayName: trimmedName.length > 0 ? trimmedName : null,
                            cadasturNumber: params.cadasturNumber ?? null,
                            verificationStatus: client_1.GuideVerificationStatus.PENDING,
                            languages: '', // Adicionado para compatibilidade com SQLite
                            serviceAreas: '', // Adicionado para compatibilidade com SQLite
                        },
                    }
                    : undefined,
            },
        });
        const accessToken = this.signAccessToken(user);
        const refreshToken = await this.createSession(user.id);
        return {
            user: toBasicProfile(user),
            accessToken,
            refreshToken,
        };
    }
    async refresh(refreshToken) {
        const payload = this.verifyRefreshToken(refreshToken);
        const now = new Date();
        const hashedToken = hashToken(payload.sid);
        const session = await this.prismaClient.authSession.findUnique({
            where: { tokenHash: hashedToken },
            include: { user: true },
        });
        if (!session || !session.user || session.userId !== payload.sub) {
            throw new error_1.HttpError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
        }
        if (session.revokedAt) {
            throw new error_1.HttpError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token has been revoked');
        }
        if (session.expiresAt.getTime() <= now.getTime()) {
            await this.prismaClient.authSession.update({
                where: { id: session.id },
                data: { revokedAt: now },
            }).catch(() => undefined);
            throw new error_1.HttpError(401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token has expired');
        }
        await this.prismaClient.authSession.update({
            where: { id: session.id },
            data: { revokedAt: now },
        });
        const newRefreshToken = await this.createSession(session.userId);
        const accessToken = this.signAccessToken(session.user);
        return {
            user: toBasicProfile(session.user),
            accessToken,
            refreshToken: newRefreshToken,
        };
    }
    async getUserProfile(userId) {
        if (!userId) {
            return null;
        }
        const user = await this.prismaClient.user.findUnique({
            where: { id: userId },
        });
        return user ? toBasicProfile(user) : null;
    }
    async logout(refreshToken) {
        if (!refreshToken) {
            return;
        }
        try {
            const payload = this.verifyRefreshToken(refreshToken);
            const hashedToken = hashToken(payload.sid);
            await this.prismaClient.authSession.updateMany({
                where: { tokenHash: hashedToken, revokedAt: null },
                data: { revokedAt: new Date() },
            });
        }
        catch (error) {
            if (error instanceof error_1.HttpError && error.statusCode >= 500) {
                throw error;
            }
        }
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map