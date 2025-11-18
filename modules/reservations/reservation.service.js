"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminReservationService = exports.AdminReservationService = void 0;
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
const BOOKABLE_EXPEDITION_STATUSES = new Set([
    client_1.ExpeditionStatus.PUBLISHED,
    client_1.ExpeditionStatus.SCHEDULED,
    client_1.ExpeditionStatus.IN_PROGRESS,
]);
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
const normalizeStatusFilter = (status) => {
    if (!status) {
        return undefined;
    }
    const toStatus = (value) => {
        const upper = value.trim().toUpperCase();
        if (!upper) {
            throw new error_1.HttpError(400, 'INVALID_STATUS', 'Status filter cannot be empty');
        }
        if (!(upper in client_1.ReservationStatus)) {
            throw new error_1.HttpError(400, 'INVALID_STATUS', `Invalid reservation status: ${value}`);
        }
        return client_1.ReservationStatus[upper];
    };
    if (Array.isArray(status)) {
        return status.map(toStatus);
    }
    return [toStatus(status)];
};
const toReservationSummary = (reservation) => ({
    id: reservation.id,
    code: reservation.code,
    status: reservation.status,
    headcount: reservation.headcount,
    totalCents: reservation.totalCents,
    feeCents: reservation.feeCents,
    discountCents: reservation.discountCents,
    currency: reservation.currency,
    bookedAt: reservation.bookedAt.toISOString(),
    confirmedAt: reservation.confirmedAt ? reservation.confirmedAt.toISOString() : null,
    cancelledAt: reservation.cancelledAt ? reservation.cancelledAt.toISOString() : null,
    expedition: {
        id: reservation.expedition.id,
        title: reservation.expedition.title,
        status: reservation.expedition.status,
        startDate: reservation.expedition.startDate.toISOString(),
        endDate: reservation.expedition.endDate.toISOString(),
    },
    user: {
        id: reservation.user.id,
        name: reservation.user.name ?? null,
        email: reservation.user.email,
    },
});
const toReservationDetail = (reservation) => ({
    ...toReservationSummary(reservation),
    notes: reservation.notes ?? null,
    internalNotes: reservation.internalNotes ?? null,
    emergencyContactName: reservation.emergencyContactName ?? null,
    emergencyContactPhone: reservation.emergencyContactPhone ?? null,
    cancellationReason: reservation.cancellationReason ?? null,
});
const generateReservationCode = () => {
    return `RSV-${(0, node_crypto_1.randomUUID)().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
};
const parseReservationStatus = (status, fallback) => {
    if (!status) {
        return fallback;
    }
    if (!(status in client_1.ReservationStatus)) {
        throw new error_1.HttpError(400, 'INVALID_STATUS', `Invalid reservation status: ${status}`);
    }
    return client_1.ReservationStatus[status];
};
const sanitizeCancellationReason = (reason) => {
    const sanitized = sanitizeOptionalText(reason);
    return sanitized ?? null;
};
const updateExpeditionAvailability = async (tx, expeditionId) => {
    const aggregate = await tx.reservation.aggregate({
        where: {
            expeditionId,
            status: { in: ACTIVE_RESERVATION_STATUSES },
        },
        _sum: { headcount: true },
    });
    const expedition = await tx.expedition.findUnique({
        where: { id: expeditionId },
        select: { maxParticipants: true, status: true },
    });
    if (!expedition) {
        throw new error_1.HttpError(404, 'EXPEDITION_NOT_FOUND', 'Expedition not found');
    }
    const reserved = aggregate._sum.headcount ?? 0;
    const shouldForceZero = expedition.status === client_1.ExpeditionStatus.CANCELLED ||
        expedition.status === client_1.ExpeditionStatus.COMPLETED;
    const available = shouldForceZero
        ? 0
        : Math.max(expedition.maxParticipants - reserved, 0);
    await tx.expedition.update({
        where: { id: expeditionId },
        data: { availableSpots: available },
    });
};
const calculateTotalCents = (pricePerPersonCents, headcount, feeCents, discountCents) => {
    const baseAmount = pricePerPersonCents * headcount;
    const total = baseAmount + feeCents - discountCents;
    return total < 0 ? 0 : total;
};
class AdminReservationService {
    prismaClient;
    constructor(prismaClient = prisma_1.prisma) {
        this.prismaClient = prismaClient;
    }
    async listReservations(params) {
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
        if (params.expeditionId) {
            where.expeditionId = params.expeditionId;
        }
        if (params.userId) {
            where.userId = params.userId;
        }
        const [reservations, totalItems] = await this.prismaClient.$transaction([
            this.prismaClient.reservation.findMany({
                where,
                orderBy: { bookedAt: 'desc' },
                skip,
                take: pageSize,
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    expedition: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                            startDate: true,
                            endDate: true,
                            priceCents: true,
                            currency: true,
                        },
                    },
                },
            }),
            this.prismaClient.reservation.count({ where }),
        ]);
        const summaries = reservations.map(toReservationSummary);
        const pagination = buildPaginationMeta(totalItems, page, pageSize);
        return { reservations: summaries, pagination };
    }
    async createReservation(actor, body, context) {
        const headcount = body.headcount ?? 1;
        if (headcount <= 0) {
            throw new error_1.HttpError(400, 'INVALID_HEADCOUNT', 'Headcount must be greater than zero');
        }
        return this.prismaClient.$transaction(async (tx) => {
            const expedition = await tx.expedition.findFirst({
                where: { id: body.expeditionId, deletedAt: null },
                select: {
                    id: true,
                    status: true,
                    maxParticipants: true,
                    priceCents: true,
                    currency: true,
                },
            });
            if (!expedition) {
                throw new error_1.HttpError(404, 'EXPEDITION_NOT_FOUND', 'Expedition not found');
            }
            if (!BOOKABLE_EXPEDITION_STATUSES.has(expedition.status)) {
                throw new error_1.HttpError(400, 'EXPEDITION_NOT_BOOKABLE', `Reservations cannot be created when expedition status is ${expedition.status}`);
            }
            const user = await tx.user.findUnique({
                where: { id: body.userId },
                select: { id: true },
            });
            if (!user) {
                throw new error_1.HttpError(404, 'USER_NOT_FOUND', 'User not found');
            }
            const aggregate = await tx.reservation.aggregate({
                where: { expeditionId: body.expeditionId, status: { in: ACTIVE_RESERVATION_STATUSES } },
                _sum: { headcount: true },
            });
            const reserved = aggregate._sum.headcount ?? 0;
            if (reserved + headcount > expedition.maxParticipants) {
                throw new error_1.HttpError(409, 'EXPEDITION_FULL', 'Expedition capacity has been reached');
            }
            const status = parseReservationStatus(body.status, client_1.ReservationStatus.PENDING);
            if (status === client_1.ReservationStatus.CANCELLED || status === client_1.ReservationStatus.EXPIRED) {
                throw new error_1.HttpError(400, 'INVALID_STATUS', 'Reservations cannot be created directly with CANCELLED or EXPIRED status');
            }
            const feeCents = body.feeCents ?? 0;
            const discountCents = body.discountCents ?? 0;
            const totalCents = calculateTotalCents(expedition.priceCents, headcount, feeCents, discountCents);
            const now = new Date();
            const reservation = await tx.reservation.create({
                data: {
                    code: generateReservationCode(),
                    expeditionId: expedition.id,
                    userId: body.userId,
                    status,
                    headcount,
                    totalCents,
                    feeCents,
                    discountCents,
                    currency: expedition.currency,
                    emergencyContactName: sanitizeOptionalText(body.emergencyContactName) ?? null,
                    emergencyContactPhone: sanitizeOptionalText(body.emergencyContactPhone) ?? null,
                    notes: sanitizeOptionalText(body.notes) ?? null,
                    internalNotes: sanitizeOptionalText(body.internalNotes) ?? null,
                    bookedAt: now,
                    confirmedAt: status === client_1.ReservationStatus.CONFIRMED ? now : null,
                    cancelledAt: null,
                    cancellationReason: null,
                },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    expedition: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                            startDate: true,
                            endDate: true,
                            priceCents: true,
                            currency: true,
                            maxParticipants: true,
                        },
                    },
                },
            });
            await updateExpeditionAvailability(tx, expedition.id);
            await (0, audit_service_1.audit)({
                userId: actor.actorId,
                entity: 'reservation',
                entityId: reservation.id,
                action: 'CREATE',
                diff: {
                    expeditionId: reservation.expeditionId,
                    userId: reservation.userId,
                    status: reservation.status,
                    headcount: reservation.headcount,
                    totalCents: reservation.totalCents,
                },
                ip: context.ip,
                userAgent: context.userAgent,
            });
            return toReservationDetail(reservation);
        });
    }
    async updateReservation(actor, id, body, context) {
        return this.prismaClient.$transaction(async (tx) => {
            const reservation = await tx.reservation.findFirst({
                where: { id, deletedAt: null },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    expedition: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                            startDate: true,
                            endDate: true,
                            priceCents: true,
                            currency: true,
                            maxParticipants: true,
                        },
                    },
                },
            });
            if (!reservation) {
                throw new error_1.HttpError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found');
            }
            const newHeadcount = body.headcount ?? reservation.headcount;
            if (newHeadcount <= 0) {
                throw new error_1.HttpError(400, 'INVALID_HEADCOUNT', 'Headcount must be greater than zero');
            }
            const newStatus = parseReservationStatus(body.status, reservation.status);
            const wasActive = ACTIVE_RESERVATION_STATUSES.includes(reservation.status);
            const willBeActive = ACTIVE_RESERVATION_STATUSES.includes(newStatus);
            const aggregate = await tx.reservation.aggregate({
                where: {
                    expeditionId: reservation.expeditionId,
                    status: { in: ACTIVE_RESERVATION_STATUSES },
                },
                _sum: { headcount: true },
            });
            const currentReserved = aggregate._sum.headcount ?? 0;
            const reservedWithoutCurrent = wasActive ? currentReserved - reservation.headcount : currentReserved;
            const projectedReserved = willBeActive ? reservedWithoutCurrent + newHeadcount : reservedWithoutCurrent;
            if (projectedReserved > reservation.expedition.maxParticipants) {
                throw new error_1.HttpError(409, 'EXPEDITION_FULL', 'Expedition capacity has been reached');
            }
            const feeCents = reservation.feeCents;
            const discountCents = reservation.discountCents;
            const totalCents = calculateTotalCents(reservation.expedition.priceCents, newHeadcount, feeCents, discountCents);
            const now = new Date();
            const updateData = {
                headcount: newHeadcount,
                totalCents,
                status: newStatus,
            };
            if (body.notes !== undefined) {
                updateData.notes = sanitizeOptionalText(body.notes) ?? null;
            }
            if (body.internalNotes !== undefined) {
                updateData.internalNotes = sanitizeOptionalText(body.internalNotes) ?? null;
            }
            if (body.emergencyContactName !== undefined) {
                updateData.emergencyContactName = sanitizeOptionalText(body.emergencyContactName) ?? null;
            }
            if (body.emergencyContactPhone !== undefined) {
                updateData.emergencyContactPhone = sanitizeOptionalText(body.emergencyContactPhone) ?? null;
            }
            if (newStatus === client_1.ReservationStatus.CONFIRMED) {
                updateData.confirmedAt = now;
                updateData.cancelledAt = null;
                updateData.cancellationReason = null;
            }
            else if (reservation.status === client_1.ReservationStatus.CONFIRMED) {
                updateData.confirmedAt = null;
            }
            if (newStatus === client_1.ReservationStatus.CANCELLED) {
                updateData.cancelledAt = now;
                updateData.cancellationReason = sanitizeCancellationReason(body.cancellationReason ?? reservation.cancellationReason);
            }
            else if (body.cancellationReason !== undefined) {
                updateData.cancellationReason = sanitizeCancellationReason(body.cancellationReason);
            }
            if (newStatus !== client_1.ReservationStatus.CANCELLED && reservation.status === client_1.ReservationStatus.CANCELLED) {
                updateData.cancelledAt = null;
                if (body.cancellationReason === undefined) {
                    updateData.cancellationReason = null;
                }
            }
            const updated = await tx.reservation.update({
                where: { id: reservation.id },
                data: updateData,
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    expedition: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                            startDate: true,
                            endDate: true,
                            priceCents: true,
                            currency: true,
                            maxParticipants: true,
                        },
                    },
                },
            });
            await updateExpeditionAvailability(tx, reservation.expeditionId);
            await (0, audit_service_1.audit)({
                userId: actor.actorId,
                entity: 'reservation',
                entityId: updated.id,
                action: 'UPDATE',
                diff: {
                    previousStatus: reservation.status,
                    newStatus,
                    headcount: newHeadcount,
                    notesChanged: body.notes !== undefined,
                    internalNotesChanged: body.internalNotes !== undefined,
                    emergencyContactUpdated: body.emergencyContactName !== undefined || body.emergencyContactPhone !== undefined,
                },
                ip: context.ip,
                userAgent: context.userAgent,
            });
            return toReservationDetail(updated);
        });
    }
}
exports.AdminReservationService = AdminReservationService;
exports.adminReservationService = new AdminReservationService();
//# sourceMappingURL=reservation.service.js.map