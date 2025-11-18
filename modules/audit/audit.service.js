"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.audit = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../services/prisma");
const sanitizeDiff = (diff) => {
    if (diff === undefined || diff === null) {
        return client_1.Prisma.JsonNull;
    }
    try {
        return JSON.parse(JSON.stringify(diff));
    }
    catch {
        return client_1.Prisma.JsonNull;
    }
};
const audit = async (input) => {
    const { userId, entity, entityId, action, diff, ip, userAgent } = input;
    if (!entity || !action) {
        return;
    }
    try {
        await prisma_1.prisma.auditLog.create({
            data: {
                userId: userId ?? null,
                entity,
                entityId: entityId ?? null,
                action,
                diff: sanitizeDiff(diff),
                ip: ip ?? null,
                userAgent: userAgent ?? null,
            },
        });
    }
    catch (error) {
        // Auditing must never block main operations. Log and continue.
        console.error('Failed to write audit log entry', error);
    }
};
exports.audit = audit;
//# sourceMappingURL=audit.service.js.map