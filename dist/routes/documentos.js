"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
const estados_1 = require("../utils/estados");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
const getNumericId = (param) => {
    const value = Array.isArray(param) ? param[0] : param;
    const num = parseInt(value);
    return isNaN(num) ? null : num;
};
// ============================================
// LISTADOS
// ============================================
router.get("/listado/estados", auth_1.authenticateToken, (0, permissions_1.requirePermission)("documentos", "leer"), async (req, res) => {
    try {
        const estados = await db_1.default.estado.findMany({ where: { entidad: "DOCUMENTO" }, orderBy: { nombre: "asc" } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(estados));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener estados", error));
    }
});
router.get("/listado/miembros", auth_1.authenticateToken, (0, permissions_1.requirePermission)("documentos", "leer"), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const miembros = await db_1.default.miembro.findMany({
            where: { ...congregacionFilter },
            select: { id_miembro: true, nombres: true, apellidos: true },
            orderBy: { apellidos: "asc" },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(miembros));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener miembros", error));
    }
});
// ============================================
// CRUD DOCUMENTOS
// ============================================
router.get("/", auth_1.authenticateToken, (0, permissions_1.requirePermission)("documentos", "leer"), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const documentos = await db_1.default.documento.findMany({
            where: { miembro: { ...congregacionFilter } },
            take: 200,
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
            orderBy: { fecha_emision: "desc" },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(documentos));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener documentos", error));
    }
});
router.get("/miembro/:idMiembro", auth_1.authenticateToken, (0, permissions_1.requirePermission)("documentos", "leer"), async (req, res) => {
    try {
        const idMiembro = getNumericId(req.params.idMiembro);
        if (idMiembro === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID de miembro inválido"));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const miembro = await db_1.default.miembro.findFirst({ where: { id_miembro: idMiembro, ...congregacionFilter } });
        if (!miembro)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Miembro no encontrado"));
        const documentos = await db_1.default.documento.findMany({
            where: { id_miembro: idMiembro },
            include: { estado: true },
            orderBy: { fecha_emision: "desc" },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(documentos));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener documentos del miembro", error));
    }
});
router.get("/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("documentos", "leer"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const documento = await db_1.default.documento.findFirst({
            where: { id_documento: id, miembro: { ...congregacionFilter } },
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
        });
        if (!documento)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Documento no encontrado"));
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(documento));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener documento", error));
    }
});
router.post("/", auth_1.authenticateToken, (0, permissions_1.requirePermission)("documentos", "crear"), async (req, res) => {
    try {
        const { id_miembro, tipo_documento, numero_serie, fecha_emision, archivo_url, id_estado } = req.body;
        if (!id_miembro || !tipo_documento) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("Faltan campos requeridos"));
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const miembro = await db_1.default.miembro.findFirst({ where: { id_miembro: parseInt(String(id_miembro)), ...congregacionFilter } });
        if (!miembro)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Miembro no encontrado o no accesible"));
        let estadoId = id_estado ? parseInt(String(id_estado)) : null;
        if (!estadoId) {
            const estadoVigente = await (0, estados_1.getEstadoByCodigo)("DOCUMENTO", "VIGENTE");
            if (!estadoVigente)
                return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'VIGENTE' no encontrado. Ejecute el seed de estados."));
            estadoId = estadoVigente.id_estado;
        }
        const documento = await db_1.default.documento.create({
            data: {
                id_miembro: parseInt(String(id_miembro)),
                tipo_documento,
                numero_serie: numero_serie || null,
                fecha_emision: fecha_emision ? new Date(fecha_emision) : new Date(),
                id_emitido_por: req.user.userId,
                archivo_url: archivo_url || null,
                id_estado: estadoId,
            },
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(documento, "Documento creado correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al crear documento", error));
    }
});
router.put("/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("documentos", "actualizar"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.documento.findFirst({ where: { id_documento: id, miembro: { ...congregacionFilter } } });
        if (!existing)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Documento no encontrado"));
        const input = req.body;
        const updateData = {};
        if (input.tipo_documento !== undefined)
            updateData.tipo_documento = input.tipo_documento;
        if (input.numero_serie !== undefined)
            updateData.numero_serie = input.numero_serie || null;
        if (input.fecha_emision !== undefined && input.fecha_emision)
            updateData.fecha_emision = new Date(input.fecha_emision);
        if (input.archivo_url !== undefined)
            updateData.archivo_url = input.archivo_url || null;
        if (input.id_estado !== undefined && input.id_estado)
            updateData.id_estado = parseInt(String(input.id_estado));
        const documento = await db_1.default.documento.update({
            where: { id_documento: id },
            data: updateData,
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(documento, "Documento actualizado correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al actualizar documento", error));
    }
});
router.delete("/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("documentos", "eliminar"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.documento.findFirst({ where: { id_documento: id, miembro: { ...congregacionFilter } } });
        if (!existing)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Documento no encontrado"));
        const estadoAnulado = await (0, estados_1.getEstadoByCodigo)("DOCUMENTO", "ANULADO");
        if (!estadoAnulado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'ANULADO' no encontrado"));
        await db_1.default.documento.update({ where: { id_documento: id }, data: { id_estado: estadoAnulado.id_estado } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted("Documento anulado correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al anular documento", error));
    }
});
exports.default = router;
//# sourceMappingURL=documentos.js.map