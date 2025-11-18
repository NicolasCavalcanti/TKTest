"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminExpeditionService = exports.AdminExpeditionService = void 0;
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const error_1 = require("../../middlewares/error");
const prisma_1 = require("../../services/prisma");
const audit_service_1 = require("../audit/audit.service");
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const ACTIVE_RESERVATION_STATUSES = [
    client_1.ReservationStatus.PENDING,
    client_1.ReservationStatus.CONFIRMED,
];
const normalizeString = (input) => {
    if (input === undefined || input === null) {
        return null;
    }
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : null;
};
const sanitizeOptionalText = (value) => {
    if (value === undefined) {
        return undefined;
    }
    return normalizeString(value);
};
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
const formatDateForSlug = (date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};
const slugify = (input) => {
    const normalized = input
        .normalize('NFD')
        .replace(/[^\p{Letter}\p{Number}\s-]+/gu, '')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    const slug = normalized
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
    return slug;
};
const generateSlugCandidate = (base) => {
    const suffix = (0, node_crypto_1.randomUUID)().slice(0, 6);
    const slug = slugify(`${base}-${suffix}`);
    if (slug.length === 0) {
        return (0, node_crypto_1.randomUUID)().replace(/-/g, '').slice(0, 12);
    }
    return slug;
};
const normalizeRoles = (roles) => {
    return new Set(roles.map((role) => role.trim().toUpperCase()).filter((role) => role.length > 0));
};
const hasAdministrativeRole = (roles) => {
    return roles.has('ADMIN') || roles.has('EDITOR') || roles.has('OPERADOR');
};
const normalizeStatusFilter = (status) => {
    if (!status) {
        return undefined;
    }
    const toStatus = (value) => {
        const upper = value.trim().toUpperCase();
        if (!upper) {
            throw new error_1.HttpError(400, 'INVALID_STATUS', 'Status filter cannot be empty');
        }
        if (!(upper in client_1.ExpeditionStatus)) {
            throw new error_1.HttpError(400, 'INVALID_STATUS', `Invalid expedition status: ${value}`);
        }
        return client_1.ExpeditionStatus[upper];
    };
    if (Array.isArray(status)) {
        return status.map(toStatus);
    }
    return [toStatus(status)];
};
const calculateBookedHeadcount = (reservations) => {
    return reservations.reduce((sum, reservation) => sum + reservation.headcount, 0);
};
const toExpeditionSummary = (expedition) => {
    const bookedHeadcount = calculateBookedHeadcount(expedition.reservations);
    const availableSpots = Math.max(expedition.maxParticipants - bookedHeadcount, 0);
    return {
        id: expedition.id,
        title: expedition.title,
        status: expedition.status,
        startDate: expedition.startDate.toISOString(),
        endDate: expedition.endDate.toISOString(),
        priceCents: expedition.priceCents,
        currency: expedition.currency,
        maxParticipants: expedition.maxParticipants,
        availableSpots,
        bookedHeadcount,
        reservationsCount: expedition.reservations.length,
        trail: expedition.trail ? { id: expedition.trail.id, name: expedition.trail.name } : null,
        leadGuide: expedition.leadGuide
            ? {
                id: expedition.leadGuide.id,
                name: expedition.leadGuide.displayName ?? expedition.leadGuide.user.name ?? null,
            }
            : null,
        createdAt: expedition.createdAt.toISOString(),
        updatedAt: expedition.updatedAt.toISOString(),
    };
};
const toExpeditionDetail = (expedition) => {
    const activeReservations = expedition.reservations.filter((reservation) => ACTIVE_RESERVATION_STATUSES.includes(reservation.status));
    const bookedHeadcount = activeReservations.reduce((sum, reservation) => sum + reservation.headcount, 0);
    const availableSpots = Math.max(expedition.maxParticipants - bookedHeadcount, 0);
    return {
        id: expedition.id,
        title: expedition.title,
        status: expedition.status,
        startDate: expedition.startDate.toISOString(),
        endDate: expedition.endDate.toISOString(),
        priceCents: expedition.priceCents,
        currency: expedition.currency,
        maxParticipants: expedition.maxParticipants,
        availableSpots,
        bookedHeadcount,
        reservationsCount: activeReservations.length,
        trail: expedition.trail ? { id: expedition.trail.id, name: expedition.trail.name } : null,
        leadGuide: expedition.leadGuide
            ? {
                id: expedition.leadGuide.id,
                name: expedition.leadGuide.displayName ?? expedition.leadGuide.user.name ?? null,
            }
            : null,
        createdAt: expedition.createdAt.toISOString(),
        updatedAt: expedition.updatedAt.toISOString(),
        description: expedition.description ?? null,
        difficulty: expedition.difficulty ?? expedition.trail?.difficulty ?? null,
        cancellationReason: expedition.cancellationReason ?? null,
        publishedAt: expedition.publishedAt ? expedition.publishedAt.toISOString() : null,
        cancelledAt: expedition.cancelledAt ? expedition.cancelledAt.toISOString() : null,
        notes: expedition.notes ?? null,
        reservations: expedition.reservations.map((reservation) => ({
            id: reservation.id,
            code: reservation.code,
            status: reservation.status,
            headcount: reservation.headcount,
            bookedAt: reservation.bookedAt.toISOString(),
            confirmedAt: reservation.confirmedAt ? reservation.confirmedAt.toISOString() : null,
            cancelledAt: reservation.cancelledAt ? reservation.cancelledAt.toISOString() : null,
            user: {
                id: reservation.user.id,
                name: reservation.user.name ?? null,
                email: reservation.user.email,
            },
        })),
    };
};
const ensureChronology = (startDate, endDate) => {
    if (endDate <= startDate) {
        throw new error_1.HttpError(400, 'INVALID_DATE_RANGE', 'Expedition end date must be after the start date');
    }
};
const normalizePriceCents = (body) => {
    if (body.priceCents !== undefined) {
        if (!Number.isInteger(body.priceCents) || body.priceCents < 0) {
            throw new error_1.HttpError(400, 'INVALID_PRICE', 'priceCents must be a positive integer');
        }
        return body.priceCents;
    }
    if (body.pricePerPerson === undefined) {
        throw new error_1.HttpError(400, 'PRICE_REQUIRED', 'Expedition price is required');
    }
    const cents = Math.round(body.pricePerPerson * 100);
    if (!Number.isFinite(cents) || cents < 0) {
        throw new error_1.HttpError(400, 'INVALID_PRICE', 'pricePerPerson must result in a positive amount');
    }
    return cents;
};
const ensureGuideExists = async (tx, guideId) => {
    const guide = await tx.guideProfile.findUnique({
        where: { id: guideId },
        select: { id: true },
    });
    if (!guide) {
        throw new error_1.HttpError(404, 'GUIDE_NOT_FOUND', 'Guide not found');
    }
    return guide.id;
};
const resolveGuideId = async (tx, actor, requestedGuideId) => {
    const roles = normalizeRoles(actor.roles ?? []);
    if (hasAdministrativeRole(roles)) {
        if (!requestedGuideId) {
            return requestedGuideId ?? null;
        }
        return ensureGuideExists(tx, requestedGuideId);
    }
    if (roles.has('GUIA')) {
        if (!actor.actorId) {
            throw new error_1.HttpError(403, 'GUIDE_PROFILE_REQUIRED', 'Guide profile is required');
        }
        const guide = await tx.guideProfile.findUnique({
            where: { userId: actor.actorId },
            select: { id: true },
        });
        if (!guide) {
            throw new error_1.HttpError(403, 'GUIDE_PROFILE_NOT_FOUND', 'Guide profile not found for user');
        }
        if (requestedGuideId && requestedGuideId !== guide.id) {
            throw new error_1.HttpError(403, 'GUIDE_MISMATCH', 'Guides can only manage expeditions assigned to themselves');
        }
        return guide.id;
    }
    if (requestedGuideId) {
        return ensureGuideExists(tx, requestedGuideId);
    }
    return null;
};
const assertGuideAccess = async (tx, actor, expedition) => {
    const roles = normalizeRoles(actor.roles ?? []);
    if (hasAdministrativeRole(roles)) {
        return;
    }
    if (!roles.has('GUIA')) {
        throw new error_1.HttpError(403, 'ACCESS_DENIED', 'Insufficient permissions to manage expedition');
    }
    if (!actor.actorId) {
        throw new error_1.HttpError(403, 'GUIDE_PROFILE_REQUIRED', 'Guide profile is required');
    }
    const guide = await tx.guideProfile.findUnique({
        where: { userId: actor.actorId },
        select: { id: true },
    });
    if (!guide || expedition.leadGuideId !== guide.id) {
        throw new error_1.HttpError(403, 'ACCESS_DENIED', 'Guides can only access their own expeditions');
    }
};
const recalculateAvailability = async (tx, expeditionId, options = {}) => {
    const aggregate = await tx.reservation.aggregate({
        where: {
            expeditionId,
            status: { in: ACTIVE_RESERVATION_STATUSES },
        },
        _sum: { headcount: true },
    });
    let { maxParticipants, status } = options;
    if (maxParticipants === undefined || status === undefined) {
        const expedition = await tx.expedition.findUnique({
            where: { id: expeditionId },
            select: { maxParticipants: true, status: true },
        });
        if (!expedition) {
            throw new error_1.HttpError(404, 'EXPEDITION_NOT_FOUND', 'Expedition not found');
        }
        if (maxParticipants === undefined) {
            maxParticipants = expedition.maxParticipants;
        }
        if (status === undefined) {
            status = expedition.status;
        }
    }
    const reserved = aggregate._sum.headcount ?? 0;
    const shouldForceZero = status === client_1.ExpeditionStatus.CANCELLED || status === client_1.ExpeditionStatus.COMPLETED;
    const available = shouldForceZero ? 0 : Math.max((maxParticipants ?? 0) - reserved, 0);
    await tx.expedition.update({
        where: { id: expeditionId },
        data: { availableSpots: available },
    });
    return available;
};
class AdminExpeditionService {
    prismaClient;
    constructor(prismaClient = prisma_1.prisma) {
        this.prismaClient = prismaClient;
    }
    async listExpeditions(params) {
        const page = Math.max(1, params.page ?? 1);
        const rawPageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
        const pageSize = Math.max(1, Math.min(rawPageSize, MAX_PAGE_SIZE));
        const skip = (page - 1) * pageSize;
        const statusFilter = normalizeStatusFilter(params.status);
        const where = {
            deletedAt: null,
        };
        if (statusFilter && statusFilter.length > 0) {
            where.status = { in: statusFilter };
        }
        if (params.guideId) {
            where.leadGuideId = params.guideId;
        }
        if (params.trailId) {
            where.trailId = params.trailId;
        }
        if (params.from || params.to) {
            where.startDate = {};
            if (params.from) {
                where.startDate.gte = params.from;
            }
            if (params.to) {
                where.startDate.lte = params.to;
            }
        }
        const [expeditions, totalItems] = await this.prismaClient.$transaction([
            this.prismaClient.expedition.findMany({
                where,
                orderBy: { startDate: 'asc' },
                skip,
                take: pageSize,
                include: {
                    trail: { select: { id: true, name: true } },
                    leadGuide: {
                        select: {
                            id: true,
                            displayName: true,
                            user: { select: { id: true, name: true } },
                        },
                    },
                    reservations: {
                        where: { status: { in: ACTIVE_RESERVATION_STATUSES } },
                        select: { headcount: true },
                    },
                },
            }),
            this.prismaClient.expedition.count({ where }),
        ]);
        const summaries = expeditions.map(toExpeditionSummary);
        const pagination = buildPaginationMeta(totalItems, page, pageSize);
        return { expeditions: summaries, pagination };
    }
    async createExpedition(actor, body, context) {
        if (!actor.actorId) {
            throw new error_1.HttpError(403, 'ACTOR_REQUIRED', 'Authenticated user is required');
        }
        const priceCents = normalizePriceCents(body);
        ensureChronology(body.startDate, body.endDate);
        return this.prismaClient.$transaction(async (tx) => {
            const trail = await tx.trail.findUnique({
                where: { id: body.trailId },
                select: { id: true, name: true, difficulty: true },
            });
            if (!trail) {
                throw new error_1.HttpError(404, 'TRAIL_NOT_FOUND', 'Trail not found');
            }
            const guideId = await resolveGuideId(tx, actor, body.guideId ?? null);
            const baseTitle = trail.name;
            const slugBase = `${baseTitle}-${formatDateForSlug(body.startDate)}`;
            let lastError;
            for (let attempt = 0; attempt < 5; attempt += 1) {
                const slug = generateSlugCandidate(slugBase);
                try {
                    const expedition = await tx.expedition.create({
                        data: {
                            slug,
                            title: baseTitle,
                            description: body.description.trim(),
                            status: client_1.ExpeditionStatus.DRAFT,
                            difficulty: trail.difficulty,
                            startDate: body.startDate,
                            endDate: body.endDate,
                            priceCents,
                            currency: 'BRL',
                            maxParticipants: body.maxPeople,
                            availableSpots: body.maxPeople,
                            notes: null,
                            createdById: actor.actorId,
                            leadGuideId: guideId,
                            trailId: trail.id,
                        },
                        include: {
                            trail: { select: { id: true, name: true, difficulty: true } },
                            leadGuide: {
                                select: {
                                    id: true,
                                    displayName: true,
                                    user: { select: { id: true, name: true, email: true } },
                                },
                            },
                            reservations: {
                                orderBy: { bookedAt: 'asc' },
                                include: {
                                    user: { select: { id: true, name: true, email: true } },
                                },
                            },
                        },
                    });
                    await (0, audit_service_1.audit)({
                        userId: actor.actorId,
                        entity: 'expedition',
                        entityId: expedition.id,
                        action: 'CREATE',
                        diff: {
                            trailId: trail.id,
                            leadGuideId: guideId,
                            startDate: body.startDate.toISOString(),
                            endDate: body.endDate.toISOString(),
                            priceCents,
                            maxParticipants: body.maxPeople,
                        },
                        ip: context.ip,
                        userAgent: context.userAgent,
                    });
                    return toExpeditionDetail(expedition);
                }
                catch (error) {
                    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                        error.code === 'P2002' &&
                        Array.isArray(error.meta?.target) &&
                        error.meta?.target.includes('slug')) {
                        lastError = error;
                        continue;
                    }
                    throw error;
                }
            }
            throw new error_1.HttpError(409, 'SLUG_CONFLICT', 'Unable to create a unique expedition slug', lastError instanceof Error ? lastError.message : undefined);
        });
    }
    async getExpeditionById(id) {
        const expedition = await this.prismaClient.expedition.findFirst({
            where: { id, deletedAt: null },
            include: {
                trail: { select: { id: true, name: true, difficulty: true } },
                leadGuide: {
                    select: {
                        id: true,
                        displayName: true,
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
                reservations: {
                    orderBy: { bookedAt: 'asc' },
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
        if (!expedition) {
            return null;
        }
        return toExpeditionDetail(expedition);
    }
    async updateExpedition(actor, id, body, context) {
        return this.prismaClient.$transaction(async (tx) => {
            const expedition = await tx.expedition.findFirst({
                where: { id, deletedAt: null },
                include: {
                    reservations: {
                        where: { status: { in: ACTIVE_RESERVATION_STATUSES } },
                        select: { headcount: true },
                    },
                },
            });
            if (!expedition) {
                throw new error_1.HttpError(404, 'EXPEDITION_NOT_FOUND', 'Expedition not found');
            }
            await assertGuideAccess(tx, actor, expedition);
            const updateData = {};
            if (body.startDate || body.endDate) {
                const newStart = body.startDate ?? expedition.startDate;
                const newEnd = body.endDate ?? expedition.endDate;
                ensureChronology(newStart, newEnd);
                updateData.startDate = newStart;
                updateData.endDate = newEnd;
            }
            if (body.trailId && body.trailId !== expedition.trailId) {
                const trail = await tx.trail.findUnique({
                    where: { id: body.trailId },
                    select: { id: true, name: true, difficulty: true },
                });
                if (!trail) {
                    throw new error_1.HttpError(404, 'TRAIL_NOT_FOUND', 'Trail not found');
                }
                updateData.trail = { connect: { id: trail.id } };
                updateData.difficulty = trail.difficulty;
                updateData.title = trail.name;
            }
            if (body.guideId !== undefined) {
                const guideId = await resolveGuideId(tx, actor, body.guideId);
                updateData.leadGuide = guideId ? { connect: { id: guideId } } : { disconnect: true };
            }
            if (body.maxPeople !== undefined) {
                const bookedHeadcount = calculateBookedHeadcount(expedition.reservations);
                if (body.maxPeople < bookedHeadcount) {
                    throw new error_1.HttpError(409, 'MAX_PARTICIPANTS_TOO_LOW', 'maxPeople cannot be lower than current reservations headcount');
                }
                updateData.maxParticipants = body.maxPeople;
                const isClosed = expedition.status === client_1.ExpeditionStatus.CANCELLED ||
                    expedition.status === client_1.ExpeditionStatus.COMPLETED;
                updateData.availableSpots = isClosed
                    ? 0
                    : Math.max(body.maxPeople - bookedHeadcount, 0);
            }
            if (body.pricePerPerson !== undefined || body.priceCents !== undefined) {
                updateData.priceCents = normalizePriceCents(body);
            }
            if (body.description !== undefined) {
                updateData.description = sanitizeOptionalText(body.description) ?? null;
            }
            const updated = await tx.expedition.update({
                where: { id },
                data: updateData,
                include: {
                    trail: { select: { id: true, name: true, difficulty: true } },
                    leadGuide: {
                        select: {
                            id: true,
                            displayName: true,
                            user: { select: { id: true, name: true, email: true } },
                        },
                    },
                    reservations: {
                        orderBy: { bookedAt: 'asc' },
                        include: {
                            user: { select: { id: true, name: true, email: true } },
                        },
                    },
                },
            });
            if (body.maxPeople === undefined) {
                await recalculateAvailability(tx, id, {
                    maxParticipants: updated.maxParticipants,
                    status: updated.status,
                });
            }
            await (0, audit_service_1.audit)({
                userId: actor.actorId,
                entity: 'expedition',
                entityId: updated.id,
                action: 'UPDATE',
                diff: {
                    startDate: body.startDate ? body.startDate.toISOString() : undefined,
                    endDate: body.endDate ? body.endDate.toISOString() : undefined,
                    priceCents: updateData.priceCents,
                    maxParticipants: body.maxPeople,
                    leadGuideId: body.guideId ?? undefined,
                    trailId: body.trailId ?? undefined,
                },
                ip: context.ip,
                userAgent: context.userAgent,
            });
            return toExpeditionDetail(updated);
        });
    }
    async updateExpeditionStatus(actor, id, body, context) {
        return this.prismaClient.$transaction(async (tx) => {
            const expedition = await tx.expedition.findFirst({
                where: { id, deletedAt: null },
                include: {
                    reservations: {
                        include: {
                            user: { select: { id: true, name: true, email: true } },
                        },
                    },
                    trail: { select: { id: true, name: true, difficulty: true } },
                    leadGuide: {
                        select: {
                            id: true,
                            displayName: true,
                            user: { select: { id: true, name: true, email: true } },
                        },
                    },
                },
            });
            if (!expedition) {
                throw new error_1.HttpError(404, 'EXPEDITION_NOT_FOUND', 'Expedition not found');
            }
            const data = {
                status: body.status,
            };
            const now = new Date();
            if (body.status === client_1.ExpeditionStatus.PUBLISHED && !expedition.publishedAt) {
                data.publishedAt = now;
            }
            if (body.status === client_1.ExpeditionStatus.CANCELLED) {
                data.cancelledAt = now;
                data.cancellationReason = sanitizeOptionalText(body.reason) ?? 'Expedition cancelled';
                await tx.reservation.updateMany({
                    where: {
                        expeditionId: expedition.id,
                        status: { in: [client_1.ReservationStatus.PENDING, client_1.ReservationStatus.CONFIRMED, client_1.ReservationStatus.WAITLISTED] },
                    },
                    data: {
                        status: client_1.ReservationStatus.CANCELLED,
                        cancelledAt: now,
                        cancellationReason: sanitizeOptionalText(body.reason) ?? 'Expedition cancelled',
                    },
                });
            }
            else if (expedition.cancelledAt) {
                data.cancelledAt = null;
                if (body.reason !== undefined) {
                    data.cancellationReason = sanitizeOptionalText(body.reason) ?? null;
                }
            }
            else if (body.reason !== undefined) {
                data.cancellationReason = sanitizeOptionalText(body.reason) ?? null;
            }
            const updated = await tx.expedition.update({
                where: { id },
                data,
                include: {
                    trail: { select: { id: true, name: true, difficulty: true } },
                    leadGuide: {
                        select: {
                            id: true,
                            displayName: true,
                            user: { select: { id: true, name: true, email: true } },
                        },
                    },
                    reservations: {
                        orderBy: { bookedAt: 'asc' },
                        include: {
                            user: { select: { id: true, name: true, email: true } },
                        },
                    },
                },
            });
            await recalculateAvailability(tx, id, {
                maxParticipants: updated.maxParticipants,
                status: updated.status,
            });
            await (0, audit_service_1.audit)({
                userId: actor.actorId,
                entity: 'expedition',
                entityId: updated.id,
                action: 'UPDATE_STATUS',
                diff: {
                    previousStatus: expedition.status,
                    newStatus: updated.status,
                    reason: body.reason ?? null,
                },
                ip: context.ip,
                userAgent: context.userAgent,
            });
            return toExpeditionDetail(updated);
        });
    }
}
exports.AdminExpeditionService = AdminExpeditionService;
exports.adminExpeditionService = new AdminExpeditionService();
//# sourceMappingURL=expedition.service.js.map