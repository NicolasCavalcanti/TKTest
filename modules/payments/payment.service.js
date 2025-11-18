"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminPaymentService = exports.AdminPaymentService = void 0;
const client_1 = require("@prisma/client");
const error_1 = require("../../middlewares/error");
const prisma_1 = require("../../services/prisma");
const payments_1 = require("../../services/payments");
const audit_service_1 = require("../audit/audit.service");
const DEFAULT_COMMISSION_BASIS_POINTS = 300;
const PAYMENT_CAPTURE_LOCKED_STATUSES = [client_1.PaymentStatus.PAID, client_1.PaymentStatus.AUTHORIZED];
const resolveCommissionBasisPoints = () => {
    const raw = process.env.PAYMENTS_COMMISSION_BPS;
    if (!raw) {
        return DEFAULT_COMMISSION_BASIS_POINTS;
    }
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
        return DEFAULT_COMMISSION_BASIS_POINTS;
    }
    return parsed;
};
const centsToBRL = (value) => {
    if (!Number.isFinite(value) || value === 0) {
        return 0;
    }
    return Number((value / 100).toFixed(2));
};
const prepareMetadata = (...sources) => {
    const aggregate = {};
    for (const source of sources) {
        if (!source || typeof source !== 'object') {
            continue;
        }
        for (const [key, value] of Object.entries(source)) {
            aggregate[key] = value;
        }
    }
    if (Object.keys(aggregate).length === 0) {
        return undefined;
    }
    try {
        return JSON.parse(JSON.stringify(aggregate));
    }
    catch {
        return client_1.Prisma.JsonNull;
    }
};
const toPaymentSummary = (payment) => {
    const netAmountCents = payment.netAmountCents ?? Math.max(payment.amountCents - payment.feeCents, 0);
    const commissionBasisPoints = payment.amountCents > 0 ? Math.round((payment.feeCents * 10000) / payment.amountCents) : 0;
    return {
        id: payment.id,
        provider: payment.provider,
        method: payment.method,
        status: payment.status,
        amountCents: payment.amountCents,
        feeCents: payment.feeCents,
        netAmountCents,
        netAmountBRL: centsToBRL(netAmountCents),
        commissionBasisPoints,
        currency: payment.currency,
        transactionId: payment.transactionId ?? null,
        externalReference: payment.externalReference ?? null,
        paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
        capturedAt: payment.capturedAt ? payment.capturedAt.toISOString() : null,
        cancelledAt: payment.cancelledAt ? payment.cancelledAt.toISOString() : null,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
        reservation: {
            id: payment.reservation.id,
            code: payment.reservation.code,
            status: payment.reservation.status,
            headcount: payment.reservation.headcount,
            totalCents: payment.reservation.totalCents,
            currency: payment.reservation.currency,
            user: {
                id: payment.reservation.user.id,
                name: payment.reservation.user.name ?? null,
                email: payment.reservation.user.email,
            },
        },
        refunds: payment.refunds
            .slice()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((refund) => ({
            id: refund.id,
            amountCents: refund.amountCents,
            status: refund.status,
            processedAt: refund.processedAt ? refund.processedAt.toISOString() : null,
            createdAt: refund.createdAt.toISOString(),
            reason: refund.reason ?? null,
        })),
    };
};
const normalizeProvider = (provider) => {
    if (!provider) {
        return client_1.PaymentProvider.MERCADO_PAGO;
    }
    const upper = provider.trim().toUpperCase();
    if (!(upper in client_1.PaymentProvider)) {
        throw new error_1.HttpError(400, 'INVALID_PROVIDER', `Unsupported payment provider: ${provider}`);
    }
    return client_1.PaymentProvider[upper];
};
const normalizeMethod = (method) => {
    if (!method) {
        return client_1.PaymentMethod.PIX;
    }
    const upper = method.trim().toUpperCase();
    if (!(upper in client_1.PaymentMethod)) {
        throw new error_1.HttpError(400, 'INVALID_PAYMENT_METHOD', `Unsupported payment method: ${method}`);
    }
    return client_1.PaymentMethod[upper];
};
const extractMetadata = (metadata, extra) => {
    return prepareMetadata(metadata, Object.keys(extra).length > 0 ? extra : undefined);
};
class AdminPaymentService {
    prismaClient;
    gateway;
    constructor(prismaClient = prisma_1.prisma, commissionBasisPoints) {
        this.prismaClient = prismaClient;
        const resolvedCommission = commissionBasisPoints ?? resolveCommissionBasisPoints();
        this.gateway = new payments_1.PaymentsService({ commissionBasisPoints: resolvedCommission });
    }
    async listPayments(query) {
        const statusFilter = query.status?.map((status) => {
            const key = status;
            return client_1.PaymentStatus[key];
        });
        const payments = await this.prismaClient.payment.findMany({
            where: {
                deletedAt: null,
                ...(statusFilter ? { status: { in: statusFilter } } : {}),
            },
            include: {
                reservation: {
                    select: {
                        id: true,
                        code: true,
                        status: true,
                        headcount: true,
                        totalCents: true,
                        currency: true,
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
                refunds: {
                    orderBy: { createdAt: 'desc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return payments.map((payment) => toPaymentSummary(payment));
    }
    async capturePayment(actor, params, body, context) {
        const provider = normalizeProvider(body.provider);
        const method = normalizeMethod(body.method);
        const payment = await this.prismaClient.$transaction(async (tx) => {
            const reservation = await tx.reservation.findFirst({
                where: { id: params.reservationId, deletedAt: null },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                },
            });
            if (!reservation) {
                throw new error_1.HttpError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found');
            }
            if (reservation.status === client_1.ReservationStatus.CANCELLED) {
                throw new error_1.HttpError(400, 'RESERVATION_CANCELLED', 'Cannot capture payment for a cancelled reservation');
            }
            const existingCaptured = await tx.payment.findFirst({
                where: {
                    reservationId: reservation.id,
                    deletedAt: null,
                    status: { in: PAYMENT_CAPTURE_LOCKED_STATUSES },
                },
            });
            if (existingCaptured) {
                throw new error_1.HttpError(409, 'PAYMENT_ALREADY_CAPTURED', 'Payment has already been captured for this reservation');
            }
            const captureResult = await this.gateway.capture({
                provider,
                amountCents: reservation.totalCents,
                currency: reservation.currency,
                metadata: body.metadata,
            });
            const now = new Date();
            const metadata = extractMetadata(body.metadata, {
                commissionBasisPoints: captureResult.commissionBasisPoints,
                netAmountBRL: captureResult.netAmountBRL,
                providerResponse: captureResult.rawResponse,
            });
            const existingPayment = await tx.payment.findFirst({
                where: { reservationId: reservation.id, deletedAt: null },
                orderBy: { createdAt: 'desc' },
            });
            if (!captureResult.approved) {
                const failureMetadata = extractMetadata(body.metadata, {
                    errorCode: captureResult.errorCode ?? 'UNKNOWN_ERROR',
                    errorMessage: captureResult.errorMessage ?? 'Payment capture failed',
                    providerResponse: captureResult.rawResponse,
                });
                const failedPayment = existingPayment
                    ? await tx.payment.update({
                        where: { id: existingPayment.id },
                        data: {
                            provider,
                            method,
                            status: client_1.PaymentStatus.FAILED,
                            amountCents: reservation.totalCents,
                            feeCents: 0,
                            netAmountCents: 0,
                            currency: reservation.currency,
                            transactionId: captureResult.transactionId,
                            externalReference: reservation.code,
                            paidAt: null,
                            capturedAt: null,
                            cancelledAt: null,
                            metadata: failureMetadata,
                        },
                    })
                    : await tx.payment.create({
                        data: {
                            reservationId: reservation.id,
                            provider,
                            method,
                            status: client_1.PaymentStatus.FAILED,
                            amountCents: reservation.totalCents,
                            feeCents: 0,
                            netAmountCents: 0,
                            currency: reservation.currency,
                            transactionId: captureResult.transactionId,
                            externalReference: reservation.code,
                            metadata: failureMetadata,
                        },
                    });
                await (0, audit_service_1.audit)({
                    userId: actor.actorId,
                    entity: 'payment',
                    entityId: failedPayment.id,
                    action: 'CAPTURE_FAILED',
                    diff: {
                        provider,
                        method,
                        reservationId: reservation.id,
                        amountCents: reservation.totalCents,
                        errorCode: captureResult.errorCode ?? 'UNKNOWN_ERROR',
                    },
                    ip: context.ip,
                    userAgent: context.userAgent,
                });
                throw new error_1.HttpError(422, 'PAYMENT_CAPTURE_FAILED', captureResult.errorMessage ?? 'Payment capture was declined');
            }
            const savedPayment = existingPayment
                ? await tx.payment.update({
                    where: { id: existingPayment.id },
                    data: {
                        provider,
                        method,
                        status: client_1.PaymentStatus.PAID,
                        amountCents: reservation.totalCents,
                        feeCents: captureResult.feeCents,
                        netAmountCents: captureResult.netAmountCents,
                        currency: reservation.currency,
                        transactionId: captureResult.transactionId,
                        externalReference: reservation.code,
                        metadata,
                        paidAt: now,
                        capturedAt: now,
                        cancelledAt: null,
                    },
                })
                : await tx.payment.create({
                    data: {
                        reservationId: reservation.id,
                        provider,
                        method,
                        status: client_1.PaymentStatus.PAID,
                        amountCents: reservation.totalCents,
                        feeCents: captureResult.feeCents,
                        netAmountCents: captureResult.netAmountCents,
                        currency: reservation.currency,
                        transactionId: captureResult.transactionId,
                        externalReference: reservation.code,
                        metadata,
                        paidAt: now,
                        capturedAt: now,
                    },
                });
            await tx.reservation.update({
                where: { id: reservation.id },
                data: {
                    status: client_1.ReservationStatus.CONFIRMED,
                    confirmedAt: reservation.confirmedAt ?? now,
                    cancelledAt: null,
                    cancellationReason: null,
                },
            });
            const persistedPayment = await tx.payment.findUnique({
                where: { id: savedPayment.id },
                include: {
                    reservation: {
                        select: {
                            id: true,
                            code: true,
                            status: true,
                            headcount: true,
                            totalCents: true,
                            currency: true,
                            user: { select: { id: true, name: true, email: true } },
                        },
                    },
                    refunds: {
                        orderBy: { createdAt: 'desc' },
                    },
                },
            });
            if (!persistedPayment) {
                throw new error_1.HttpError(500, 'PAYMENT_NOT_PERSISTED', 'Failed to load payment after capture');
            }
            await (0, audit_service_1.audit)({
                userId: actor.actorId,
                entity: 'payment',
                entityId: persistedPayment.id,
                action: 'CAPTURE',
                diff: {
                    provider,
                    method,
                    reservationId: reservation.id,
                    amountCents: reservation.totalCents,
                    feeCents: captureResult.feeCents,
                    netAmountCents: captureResult.netAmountCents,
                },
                ip: context.ip,
                userAgent: context.userAgent,
            });
            return persistedPayment;
        });
        return toPaymentSummary(payment);
    }
    async refundPayment(actor, params, body, context) {
        const payment = await this.prismaClient.$transaction(async (tx) => {
            const reservation = await tx.reservation.findFirst({
                where: { id: params.reservationId, deletedAt: null },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                },
            });
            if (!reservation) {
                throw new error_1.HttpError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found');
            }
            const paymentToRefund = await tx.payment.findFirst({
                where: {
                    reservationId: reservation.id,
                    deletedAt: null,
                    status: client_1.PaymentStatus.PAID,
                },
                orderBy: { createdAt: 'desc' },
                include: { refunds: true },
            });
            if (!paymentToRefund) {
                throw new error_1.HttpError(409, 'PAYMENT_NOT_CAPTURED', 'No captured payment available for refund');
            }
            const amountToRefund = body.amountCents ?? paymentToRefund.amountCents;
            if (!Number.isFinite(amountToRefund) || amountToRefund <= 0) {
                throw new error_1.HttpError(400, 'INVALID_REFUND_AMOUNT', 'Refund amount must be greater than zero');
            }
            if (amountToRefund !== paymentToRefund.amountCents) {
                throw new error_1.HttpError(400, 'PARTIAL_REFUND_UNSUPPORTED', 'Partial refunds are not supported at this time');
            }
            const refundResult = await this.gateway.refund({
                provider: paymentToRefund.provider,
                paymentId: paymentToRefund.id,
                amountCents: amountToRefund,
                currency: paymentToRefund.currency,
                metadata: body.metadata,
                reason: body.reason ?? null,
            });
            const now = new Date();
            if (!refundResult.approved) {
                await tx.paymentRefund.create({
                    data: {
                        paymentId: paymentToRefund.id,
                        amountCents: amountToRefund,
                        reason: body.reason ?? null,
                        status: client_1.PaymentStatus.FAILED,
                        processedAt: now,
                    },
                });
                await (0, audit_service_1.audit)({
                    userId: actor.actorId,
                    entity: 'payment',
                    entityId: paymentToRefund.id,
                    action: 'REFUND_FAILED',
                    diff: {
                        amountCents: amountToRefund,
                        provider: paymentToRefund.provider,
                        reservationId: reservation.id,
                        errorCode: refundResult.errorCode ?? 'UNKNOWN_ERROR',
                    },
                    ip: context.ip,
                    userAgent: context.userAgent,
                });
                throw new error_1.HttpError(422, 'PAYMENT_REFUND_FAILED', refundResult.errorMessage ?? 'Refund could not be processed');
            }
            await tx.paymentRefund.create({
                data: {
                    paymentId: paymentToRefund.id,
                    amountCents: amountToRefund,
                    reason: body.reason ?? null,
                    status: client_1.PaymentStatus.REFUNDED,
                    processedAt: now,
                },
            });
            const metadata = extractMetadata(body.metadata, {
                lastRefund: {
                    amountCents: amountToRefund,
                    netAmountBRL: refundResult.netAmountBRL,
                    providerResponse: refundResult.rawResponse,
                    reason: body.reason ?? null,
                },
            });
            await tx.payment.update({
                where: { id: paymentToRefund.id },
                data: {
                    status: client_1.PaymentStatus.REFUNDED,
                    cancelledAt: now,
                    netAmountCents: 0,
                    metadata,
                },
            });
            await tx.reservation.update({
                where: { id: reservation.id },
                data: {
                    status: client_1.ReservationStatus.CANCELLED,
                    cancelledAt: now,
                    cancellationReason: body.reason ?? reservation.cancellationReason ?? null,
                },
            });
            const persistedPayment = await tx.payment.findUnique({
                where: { id: paymentToRefund.id },
                include: {
                    reservation: {
                        select: {
                            id: true,
                            code: true,
                            status: true,
                            headcount: true,
                            totalCents: true,
                            currency: true,
                            user: { select: { id: true, name: true, email: true } },
                        },
                    },
                    refunds: {
                        orderBy: { createdAt: 'desc' },
                    },
                },
            });
            if (!persistedPayment) {
                throw new error_1.HttpError(500, 'PAYMENT_NOT_PERSISTED', 'Failed to load payment after refund');
            }
            await (0, audit_service_1.audit)({
                userId: actor.actorId,
                entity: 'payment',
                entityId: persistedPayment.id,
                action: 'REFUND',
                diff: {
                    reservationId: reservation.id,
                    amountCents: amountToRefund,
                    provider: paymentToRefund.provider,
                },
                ip: context.ip,
                userAgent: context.userAgent,
            });
            return persistedPayment;
        });
        return toPaymentSummary(payment);
    }
}
exports.AdminPaymentService = AdminPaymentService;
exports.adminPaymentService = new AdminPaymentService();
//# sourceMappingURL=payment.service.js.map