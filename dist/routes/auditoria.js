"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
const getNumericId = (param) => {
    const value = Array.isArray(param) ? param[0] : param;
    const num = parseInt(value);
    return isNaN(num) ? null : num;
};
// El id_log es BigInt — no serializable a JSON por defecto. Se convierte a string.
const serializeLog = (log) => ({
    ...log,
    id_log: log.id_log.toString(),
});
// ============================================
// AUDITORÍA (solo lectura — ADMIN/SUPERADMIN)
// ============================================
// GET log de auditoría con filtros opcionales: tabla, accion, id_usuario, limit
router.get("/", auth_1.authenticateToken, (0, permissions_1.requirePermission)("auditoria", "leer"), async (req, res) => {
    try {
        const { tabla, accion, id_usuario } = req.query;
        const limitParam = getNumericId(req.query.limit || "100");
        const take = limitParam && limitParam > 0 && limitParam <= 500 ? limitParam : 100;
        const where = {};
        if (tabla)
            where.tabla_afectada = String(tabla);
        if (accion)
            where.accion = String(accion);
        if (id_usuario) {
            const uid = getNumericId(String(id_usuario));
            if (uid !== null)
                where.id_usuario = uid;
        }
        const logs = await db_1.default.auditoriaLog.findMany({
            where,
            take,
            orderBy: { fecha_hora: "desc" },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(logs.map(serializeLog)));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener log de auditoría", error));
    }
});
// GET tablas distintas presentes en el log (para filtros)
router.get("/listado/tablas", auth_1.authenticateToken, (0, permissions_1.requirePermission)("auditoria", "leer"), async (req, res) => {
    try {
        const tablas = await db_1.default.auditoriaLog.findMany({
            distinct: ["tabla_afectada"],
            select: { tabla_afectada: true },
            orderBy: { tabla_afectada: "asc" },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(tablas.map((t) => t.tabla_afectada)));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener tablas", error));
    }
});
// GET un registro de auditoría por ID
router.get("/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("auditoria", "leer"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        const log = await db_1.default.auditoriaLog.findUnique({ where: { id_log: BigInt(id) } });
        if (!log)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Registro de auditoría no encontrado"));
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(serializeLog(log)));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener registro de auditoría", error));
    }
});
exports.default = router;
//# sourceMappingURL=auditoria.js.map