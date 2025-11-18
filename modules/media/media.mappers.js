"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMediaSummary = void 0;
const toMediaSummary = (media) => ({
    id: media.id,
    trailId: media.trailId ?? null,
    key: media.key,
    fileName: media.fileName ?? null,
    contentType: media.contentType ?? null,
    size: media.size ?? null,
    title: media.title ?? null,
    description: media.description ?? null,
    order: media.order ?? null,
    publicUrl: media.publicUrl ?? null,
    uploadedAt: media.uploadedAt ? media.uploadedAt.toISOString() : null,
    createdAt: media.createdAt.toISOString(),
    updatedAt: media.updatedAt.toISOString(),
});
exports.toMediaSummary = toMediaSummary;
//# sourceMappingURL=media.mappers.js.map