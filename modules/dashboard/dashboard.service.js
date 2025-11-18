"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminDashboardService = exports.AdminDashboardService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../services/prisma");
const OPEN_EXPEDITION_STATUSES = [
    client_1.ExpeditionStatus.PUBLISHED,
    client_1.ExpeditionStatus.SCHEDULED,
    client_1.ExpeditionStatus.IN_PROGRESS,
];
const centsToBRL = (value) => {
    if (!Number.isFinite(value) || value === 0) {
        return 0;
    }
    return Number((value / 100).toFixed(2));
};
const buildReservationMetrics = (groups) => {
    const metrics = {
        [client_1.ReservationStatus.PENDING]: 0,
        [client_1.ReservationStatus.CONFIRMED]: 0,
        [client_1.ReservationStatus.CANCELLED]: 0,
        [client_1.ReservationStatus.WAITLISTED]: 0,
        [client_1.ReservationStatus.EXPIRED]: 0,
    };
    for (const group of groups) {
        metrics[group.status] = group._count;
    }
    return metrics;
};
class AdminDashboardService {
    prismaClient;
    constructor(prismaClient = prisma_1.prisma) {
        this.prismaClient = prismaClient;
    }
    async getMetrics() {
        const [userCount, verifiedGuides, pendingGuides, trailCount, openExpeditions, reservationGroups, paymentAggregate,] = await Promise.all([
            this.prismaClient.user.count({ where: { deletedAt: null } }),
            this.prismaClient.guideProfile.count({
                where: { deletedAt: null, verificationStatus: client_1.GuideVerificationStatus.VERIFIED },
            }),
            this.prismaClient.guideProfile.count({
                where: { deletedAt: null, verificationStatus: client_1.GuideVerificationStatus.PENDING },
            }),
            this.prismaClient.trail.count({ where: { deletedAt: null } }),
            this.prismaClient.expedition.count({
                where: { deletedAt: null, status: { in: OPEN_EXPEDITION_STATUSES } },
            }),
            this.prismaClient.reservation.groupBy({
                by: ['status'],
                _count: { status: true },
                where: { deletedAt: null },
            }),
            this.prismaClient.payment.aggregate({
                where: {
                    deletedAt: null,
                    status: { in: [client_1.PaymentStatus.PAID, client_1.PaymentStatus.REFUNDED] },
                },
                _sum: {
                    amountCents: true,
                    netAmountCents: true,
                    feeCents: true,
                },
            }),
        ]);
        const reservationMetrics = buildReservationMetrics(reservationGroups.map((group) => ({ status: group.status, _count: group._count.status })));
        const grossCents = paymentAggregate._sum.amountCents ?? 0;
        const netCents = paymentAggregate._sum.netAmountCents ??
            Math.max((paymentAggregate._sum.amountCents ?? 0) - (paymentAggregate._sum.feeCents ?? 0), 0);
        return {
            totals: {
                users: userCount,
                trails: trailCount,
            },
            guides: {
                verified: verifiedGuides,
                pending: pendingGuides,
            },
            expeditions: {
                open: openExpeditions,
            },
            reservations: reservationMetrics,
            revenue: {
                grossCents,
                grossBRL: centsToBRL(grossCents),
                netCents,
                netBRL: centsToBRL(netCents),
            },
        };
    }
    async getRecentEvents(limit = 20) {
        const take = Math.min(Math.max(limit, 1), 100);
        const events = await this.prismaClient.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take,
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });
        return events.map((event) => ({
            id: event.id,
            entity: event.entity,
            entityId: event.entityId ?? null,
            action: event.action,
            diff: event.diff ?? null,
            ip: event.ip ?? null,
            userAgent: event.userAgent ?? null,
            createdAt: event.createdAt.toISOString(),
            user: event.user
                ? {
                    id: event.user.id,
                    name: event.user.name ?? null,
                    email: event.user.email,
                }
                : null,
        }));
    }
}
exports.AdminDashboardService = AdminDashboardService;
exports.adminDashboardService = new AdminDashboardService();
//# sourceMappingURL=dashboard.service.js.map