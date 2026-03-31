"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = __importDefault(require("pg"));
require("dotenv/config");
const { Pool } = pg_1.default;
const globalForPrisma = globalThis;
// Create connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});
// Create adapter - cast to any to bypass type issues
const adapter = new adapter_pg_1.PrismaPg(pool);
// Create Prisma client with adapter
exports.prisma = globalForPrisma.prisma ?? new client_1.PrismaClient({ adapter });
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
exports.default = exports.prisma;
//# sourceMappingURL=db.js.map