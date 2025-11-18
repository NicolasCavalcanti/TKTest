"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const client_1 = require("@prisma/client");
const centsToBRL = (value) => {
    if (!Number.isFinite(value) || value === 0) {
        return 0;
    }
    return Number((value / 100).toFixed(2));
};
const readBooleanFlag = (metadata, key) => {
    if (!metadata) {
        return false;
    }
    const rawValue = metadata[key];
    if (typeof rawValue === 'boolean') {
        return rawValue;
    }
    if (typeof rawValue === 'string') {
        const normalized = rawValue.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    if (typeof rawValue === 'number') {
        return rawValue === 1;
    }
    return false;
};
class ManualPaymentProvider {
    commissionBasisPoints;
    constructor(commissionBasisPoints) {
        this.commissionBasisPoints = commissionBasisPoints;
    }
    calculateCommission(amountCents) {
        if (!Number.isFinite(amountCents) || amountCents <= 0) {
            return 0;
        }
        return Math.round((amountCents * this.commissionBasisPoints) / 10000);
    }
    async capture(input) {
        const transactionId = `manual_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
        const shouldDecline = readBooleanFlag(input.metadata, 'simulateDecline');
        const commission = this.calculateCommission(input.amountCents);
        const netAmountCents = Math.max(input.amountCents - commission, 0);
        const netAmountBRL = centsToBRL(netAmountCents);
        if (shouldDecline) {
            return {
                provider: input.provider,
                approved: false,
                status: client_1.PaymentStatus.FAILED,
                transactionId,
                amountCents: input.amountCents,
                feeCents: 0,
                netAmountCents: 0,
                netAmountBRL: 0,
                commissionBasisPoints: this.commissionBasisPoints,
                rawResponse: {
                    provider: 'manual',
                    action: 'capture',
                    outcome: 'declined',
                    timestamp: new Date().toISOString(),
                },
                errorCode: 'SIMULATED_DECLINE',
                errorMessage: 'Simulated payment decline',
            };
        }
        return {
            provider: input.provider,
            approved: true,
            status: client_1.PaymentStatus.PAID,
            transactionId,
            amountCents: input.amountCents,
            feeCents: commission,
            netAmountCents,
            netAmountBRL,
            commissionBasisPoints: this.commissionBasisPoints,
            rawResponse: {
                provider: 'manual',
                action: 'capture',
                outcome: 'approved',
                timestamp: new Date().toISOString(),
            },
        };
    }
    async refund(input) {
        const shouldFail = readBooleanFlag(input.metadata, 'simulateRefundFailure');
        if (shouldFail) {
            return {
                provider: input.provider,
                approved: false,
                status: client_1.PaymentStatus.FAILED,
                refundedAmountCents: 0,
                netAmountBRL: 0,
                rawResponse: {
                    provider: 'manual',
                    action: 'refund',
                    outcome: 'failed',
                    timestamp: new Date().toISOString(),
                },
                errorCode: 'SIMULATED_REFUND_FAILURE',
                errorMessage: 'Simulated refund failure',
            };
        }
        return {
            provider: input.provider,
            approved: true,
            status: client_1.PaymentStatus.REFUNDED,
            refundedAmountCents: input.amountCents,
            netAmountBRL: centsToBRL(input.amountCents),
            rawResponse: {
                provider: 'manual',
                action: 'refund',
                outcome: 'approved',
                timestamp: new Date().toISOString(),
            },
        };
    }
}
class PaymentsService {
    commissionBasisPoints;
    manualProvider;
    providers;
    constructor(options) {
        const normalizedCommission = Number.isFinite(options.commissionBasisPoints)
            ? Math.max(0, Math.floor(options.commissionBasisPoints))
            : 0;
        this.commissionBasisPoints = normalizedCommission;
        this.manualProvider = new ManualPaymentProvider(this.commissionBasisPoints);
        this.providers = new Map();
        this.providers.set(client_1.PaymentProvider.MERCADO_PAGO, this.manualProvider);
        this.providers.set(client_1.PaymentProvider.STRIPE, this.manualProvider);
        this.providers.set(client_1.PaymentProvider.MANUAL, this.manualProvider);
    }
    getCommissionBasisPoints() {
        return this.commissionBasisPoints;
    }
    calculateCommission(amountCents) {
        if (!Number.isFinite(amountCents) || amountCents <= 0) {
            return 0;
        }
        return Math.round((amountCents * this.commissionBasisPoints) / 10000);
    }
    calculateNetAmount(amountCents) {
        const commission = this.calculateCommission(amountCents);
        return Math.max(amountCents - commission, 0);
    }
    resolveProvider(provider) {
        return this.providers.get(provider) ?? this.manualProvider;
    }
    async capture(input) {
        const provider = this.resolveProvider(input.provider);
        return provider.capture(input);
    }
    async refund(input) {
        const provider = this.resolveProvider(input.provider);
        return provider.refund(input);
    }
}
exports.PaymentsService = PaymentsService;
//# sourceMappingURL=payments.js.map