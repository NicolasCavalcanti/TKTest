"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMediaService = exports.AdminMediaService = void 0;
const error_1 = require("../../middlewares/error");
const prisma_1 = require("../../services/prisma");
const storage_1 = require("../../services/storage");
const audit_service_1 = require("../audit/audit.service");
const media_mappers_1 = require("./media.mappers");
const normalizeRoles = (roles) => {
    return new Set(roles.map((role) => role.trim().toUpperCase()).filter((role) => role.length > 0));
};
const sanitizeNullableText = (value) => {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};
class AdminMediaService {
    prismaClient;
    storageFactory;
    storageService;
    constructor(prismaClient = prisma_1.prisma, storageFactory = () => (0, storage_1.createStorageServiceFromEnv)()) {
        this.prismaClient = prismaClient;
        this.storageFactory = storageFactory;
    }
    getStorage() {
        if (!this.storageService) {
            try {
                this.storageService = this.storageFactory();
            }
            catch (error) {
                throw new error_1.HttpError(500, 'STORAGE_NOT_CONFIGURED', 'Storage service is not configured');
            }
        }
        return this.storageService;
    }
    async createTrailMediaUpload(actor, trailId, input, context) {
        const roles = normalizeRoles(actor.roles);
        if (!(roles.has('ADMIN') || roles.has('EDITOR') || roles.has('OPERADOR'))) {
            throw new error_1.HttpError(403, 'INSUFFICIENT_ROLE', 'User lacks required role');
        }
        const trail = await this.prismaClient.trail.findFirst({
            where: {
                id: trailId,
                deletedAt: null,
            },
        });
        if (!trail) {
            throw new error_1.HttpError(404, 'TRAIL_NOT_FOUND', 'Trail not found');
        }
        const storage = this.getStorage();
        const fileName = sanitizeNullableText(input.fileName) ?? undefined;
        const upload = await storage.createPresignedUpload(input.contentType, {
            fileName,
        });
        const mediaCount = await this.prismaClient.media.count({
            where: {
                trailId,
                deletedAt: null,
            },
        });
        const createdMedia = await this.prismaClient.media.create({
            data: {
                trailId,
                key: upload.key,
                fileName: sanitizeNullableText(input.fileName),
                contentType: sanitizeNullableText(input.contentType) ?? null,
                size: input.size ?? null,
                title: sanitizeNullableText(input.title),
                description: sanitizeNullableText(input.description),
                order: mediaCount + 1,
                publicUrl: upload.publicUrl,
                uploadedAt: null,
            },
        });
        const mediaSummary = (0, media_mappers_1.toMediaSummary)(createdMedia);
        await (0, audit_service_1.audit)({
            userId: actor.actorId,
            entity: 'trail_media',
            entityId: createdMedia.id,
            action: 'TRAIL_MEDIA_CREATE',
            diff: {
                trailId,
                mediaId: createdMedia.id,
                key: createdMedia.key,
                order: createdMedia.order,
                contentType: createdMedia.contentType,
                size: createdMedia.size,
            },
            ip: context.ip,
            userAgent: context.userAgent,
        });
        return {
            media: mediaSummary,
            upload,
        };
    }
    async deleteMedia(actor, mediaId, context) {
        const roles = normalizeRoles(actor.roles);
        if (!(roles.has('ADMIN') || roles.has('EDITOR'))) {
            throw new error_1.HttpError(403, 'INSUFFICIENT_ROLE', 'User lacks required role');
        }
        const now = new Date();
        const result = await this.prismaClient.$transaction(async (tx) => {
            const media = await tx.media.findFirst({
                where: {
                    id: mediaId,
                    deletedAt: null,
                },
            });
            if (!media) {
                throw new error_1.HttpError(404, 'MEDIA_NOT_FOUND', 'Media not found');
            }
            await tx.media.update({
                where: { id: mediaId },
                data: { deletedAt: now },
            });
            if (media.trailId) {
                const remaining = await tx.media.findMany({
                    where: {
                        trailId: media.trailId,
                        deletedAt: null,
                    },
                    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
                });
                let order = 1;
                for (const item of remaining) {
                    if (item.order !== order) {
                        await tx.media.update({
                            where: { id: item.id },
                            data: { order },
                        });
                    }
                    order += 1;
                }
            }
            return media;
        });
        await (0, audit_service_1.audit)({
            userId: actor.actorId,
            entity: 'trail_media',
            entityId: result.id,
            action: 'TRAIL_MEDIA_DELETE',
            diff: {
                trailId: result.trailId,
                key: result.key,
            },
            ip: context.ip,
            userAgent: context.userAgent,
        });
    }
}
exports.AdminMediaService = AdminMediaService;
exports.adminMediaService = new AdminMediaService();
//# sourceMappingURL=media.service.js.map