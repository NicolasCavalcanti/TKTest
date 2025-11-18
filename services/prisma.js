"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const prismaSingleton = () => {
    return new client_1.PrismaClient();
};
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma ?? prismaSingleton();
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
//# sourceMappingURL=prisma.js.map