"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminReviewService = void 0;
const client_1 = require("@prisma/client");
const error_1 = require("../../middlewares/error");
const prisma_1 = require("../../services/prisma");
const audit_service_1 = require("../audit/audit.service");
const review_schemas_1 = require("./review.schemas");
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const REVIEW_SORT_FIELD_MAP = new Map([
    ['createdat', (direction) => ({ createdAt: direction })],
    ['updatedat', (direction) => ({ updatedAt: direction })],
    ['rating', (direction) => ({ rating: direction })],
    ['publishedat', (direction) => ({ publishedAt: direction })],
]);
const VALID_REVIEW_STATUSES = new Set(review_schemas_1.reviewStatusValues);
const buildPaginationMeta = (totalItems, page, pageSize) => {
    const totalPages = pageSize === 0 ? 0 : Math.ceil(totalItems / pageSize);
    return {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
    };
};
const normalizeSort = (input) => {
    const defaultOrder = { createdAt: 'desc' };
    if (!input || input.trim().length === 0) {
        return [defaultOrder, { id: 'asc' }];
    }
    const segments = input
        .split(',')
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
    const orders = [];
    for (const segment of segments) {
        let direction = 'asc';
        let key = segment;
        if (segment.startsWith('-')) {
            direction = 'desc';
            key = segment.slice(1);
        }
        else if (segment.startsWith('+')) {
            key = segment.slice(1);
        }
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
        const builder = REVIEW_SORT_FIELD_MAP.get(normalizedKey);
        if (builder) {
            orders.push(builder(direction));
        }
    }
    if (orders.length === 0) {
        return [defaultOrder, { id: 'asc' }];
    }
    const hasCreatedAt = orders.some((order) => 'createdAt' in order);
    if (!hasCreatedAt) {
        orders.push(defaultOrder);
    }
    orders.push({ id: 'asc' });
    return orders;
};
const normalizeStatusFilter = (status) => {
    if (!status || status.length === 0) {
        return undefined;
    }
    const normalized = [];
    for (const raw of status) {
        const upper = raw.trim().toUpperCase();
        if (!upper) {
            continue;
        }
        const candidate = upper;
        if (!VALID_REVIEW_STATUSES.has(candidate)) {
            throw new error_1.HttpError(400, 'INVALID_STATUS', `Invalid review status: ${raw}`);
        }
        normalized.push(candidate);
    }
    return normalized.length > 0 ? normalized : undefined;
};
const normalizeSearch = (input) => {
    if (!input) {
        return undefined;
    }
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};
const normalizeRoles = (roles) => {
    return new Set(roles.map((role) => role.trim().toUpperCase()).filter((role) => role.length > 0));
};
const toReviewSummary = (review) => {
    return {
        id: review.id,
        rating: review.rating,
        title: review.title ?? null,
        comment: review.comment ?? null,
        status: review.status,
        response: review.response ?? null,
        respondedAt: review.respondedAt ? review.respondedAt.toISOString() : null,
        responseBy: review.responseBy
            ? {
                id: review.responseBy.id,
                name: review.responseBy.name ?? null,
                email: review.responseBy.email ?? null,
            }
            : null,
        publishedAt: review.publishedAt ? review.publishedAt.toISOString() : null,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
        reservation: review.reservation
            ? { id: review.reservation.id, code: review.reservation.code ?? null }
            : null,
        expedition: review.expedition
            ? {
                id: review.expedition.id,
                title: review.expedition.title,
                startDate: review.expedition.startDate.toISOString(),
                endDate: review.expedition.endDate.toISOString(),
            }
            : null,
        trail: review.trail ? { id: review.trail.id, name: review.trail.name } : null,
        guide: review.guide ? { id: review.guide.id, displayName: review.guide.displayName ?? null } : null,
        author: {
            id: review.user.id,
            name: review.user.name ?? null,
            email: review.user.email,
        },
    };
};
class AdminReviewService {
    prismaClient;
    constructor(prismaClient = prisma_1.prisma) {
        this.prismaClient = prismaClient;
    }
    async listReviews(query) {
        const page = query.page && Number.isFinite(query.page) ? query.page : 1;
        const pageSize = query.pageSize
            ? Math.min(Math.max(query.pageSize, 1), MAX_PAGE_SIZE)
            : DEFAULT_PAGE_SIZE;
        const skip = (page - 1) * pageSize;
        const statusFilter = normalizeStatusFilter(query.status);
        const search = normalizeSearch(query.search);
        const orderBy = normalizeSort(query.sort);
        const andConditions = [{ deletedAt: null }];
        if (query.guideId) {
            andConditions.push({ guideId: query.guideId });
        }
        if (query.trailId) {
            andConditions.push({ trailId: query.trailId });
        }
        if (query.expeditionId) {
            andConditions.push({ expeditionId: query.expeditionId });
        }
        if (query.reservationId) {
            andConditions.push({ reservationId: query.reservationId });
        }
        if (typeof query.rating === 'number') {
            andConditions.push({ rating: query.rating });
        }
        if (statusFilter) {
            andConditions.push({ status: { in: statusFilter } });
        }
        if (search) {
            andConditions.push({
                OR: [
                    { title: { contains: search } },
                    { comment: { contains: search } },
                    { user: { name: { contains: search } } },
                    { user: { email: { contains: search } } },
                ],
            });
        }
        const where = andConditions.length === 1 ? andConditions[0] : { AND: andConditions };
        const [reviews, totalItems] = await Promise.all([
            this.prismaClient.review.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    guide: { select: { id: true, displayName: true } },
                    trail: { select: { id: true, name: true } },
                    expedition: { select: { id: true, title: true, startDate: true, endDate: true } },
                    reservation: { select: { id: true, code: true } },
                    responseBy: { select: { id: true, name: true, email: true } },
                },
                orderBy,
                skip,
                take: pageSize,
            }),
            this.prismaClient.review.count({ where }),
        ]);
        const summaries = reviews.map(toReviewSummary);
        const pagination = buildPaginationMeta(totalItems, page, pageSize);
        return { reviews: summaries, pagination };
    }
    async deleteReview(actor, reviewId, context) {
        const roles = normalizeRoles(actor.roles);
        if (!(roles.has('ADMIN') || roles.has('EDITOR'))) {
            throw new error_1.HttpError(403, 'INSUFFICIENT_ROLE', 'User lacks required role');
        }
        const now = new Date();
        const existing = await this.prismaClient.review.findFirst({
            where: { id: reviewId, deletedAt: null },
            select: { id: true, status: true },
        });
        if (!existing) {
            throw new error_1.HttpError(404, 'REVIEW_NOT_FOUND', 'Review not found');
        }
        await this.prismaClient.review.update({
            where: { id: reviewId },
            data: { deletedAt: now, status: client_1.ReviewStatus.REJECTED },
        });
        await (0, audit_service_1.audit)({
            userId: actor.actorId,
            entity: 'review',
            entityId: reviewId,
            action: 'REVIEW_DELETE',
            diff: { reviewId, previousStatus: existing.status },
            ip: context.ip,
            userAgent: context.userAgent,
        });
    }
}
exports.adminReviewService = new AdminReviewService();
//# sourceMappingURL=review.service.js.map