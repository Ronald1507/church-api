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
router.get("/listado/estados", auth_1.authenticateToken, (0, permissions_1.requirePermission)("comunicaciones", "leer"), async (req, res) => {
    try {
        const estados = await db_1.default.estado.findMany({ where: { entidad: "COMUNICACION" }, orderBy: { nombre: "asc" } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(estados));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener estados", error));
    }
});
router.get("/listado/instituciones", auth_1.authenticateToken, (0, permissions_1.requirePermission)("comunicaciones", "leer"), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const instituciones = await db_1.default.institucion.findMany({
            where: { ...congregacionFilter },
            select: { id_institucion: true, nombre: true, tipo: true },
            orderBy: { nombre: "asc" },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(instituciones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener instituciones", error));
    }
});
// ============================================
// CRUD COMUNICACIONES
// ============================================
router.get("/", auth_1.authenticateToken, (0, permissions_1.requirePermission)("comunicaciones", "leer"), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const comunicaciones = await db_1.default.comunicacion.findMany({
            where: { ...congregacionFilter },
            take: 200,
            include: { congregacion: true, institucion: true, estado: true },
            orderBy: { created_at: "desc" },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(comunicaciones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener comunicaciones", error));
    }
});
router.get("/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("comunicaciones", "leer"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const comunicacion = await db_1.default.comunicacion.findFirst({
            where: { id_comunicacion: id, ...congregacionFilter },
            include: { congregacion: true, institucion: true, estado: true },
        });
        if (!comunicacion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Comunicación no encontrada"));
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(comunicacion));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener comunicación", error));
    }
});
router.post("/", auth_1.authenticateToken, (0, permissions_1.requirePermission)("comunicaciones", "crear"), async (req, res) => {
    try {
        const { asunto, mensaje, canal, destinatario_tipo, id_institucion, id_estado } = req.body;
        if (!asunto || !mensaje || !canal || !destinatario_tipo) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("Faltan campos requeridos"));
        }
        // Congregación: admin puede especificar; usuario usa la suya
        const { nivel } = req.user || {};
        let id_congregacion = null;
        if ((nivel === "ADMIN" || nivel === "SUPERADMIN") && req.body.id_congregacion) {
            id_congregacion = parseInt(String(req.body.id_congregacion));
        }
        else if (req.user?.id_congregacion) {
            id_congregacion = req.user.id_congregacion;
        }
        let estadoId = id_estado ? parseInt(String(id_estado)) : null;
        if (!estadoId) {
            const estadoBorrador = await (0, estados_1.getEstadoByCodigo)("COMUNICACION", "BORRADOR");
            if (!estadoBorrador)
                return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'BORRADOR' no encontrado. Ejecute el seed de estados."));
            estadoId = estadoBorrador.id_estado;
        }
        const comunicacion = await db_1.default.comunicacion.create({
            data: {
                asunto,
                mensaje,
                canal,
                destinatario_tipo,
                id_congregacion,
                id_institucion: id_institucion ? parseInt(String(id_institucion)) : null,
                id_enviado_por: req.user.userId,
                id_estado: estadoId,
            },
            include: { congregacion: true, institucion: true, estado: true },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(comunicacion, "Comunicación creada correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al crear comunicación", error));
    }
});
router.put("/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("comunicaciones", "actualizar"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.comunicacion.findFirst({ where: { id_comunicacion: id, ...congregacionFilter } });
        if (!existing)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Comunicación no encontrada"));
        const input = req.body;
        const updateData = {};
        if (input.asunto !== undefined)
            updateData.asunto = input.asunto;
        if (input.mensaje !== undefined)
            updateData.mensaje = input.mensaje;
        if (input.canal !== undefined)
            updateData.canal = input.canal;
        if (input.destinatario_tipo !== undefined)
            updateData.destinatario_tipo = input.destinatario_tipo;
        if (input.id_institucion !== undefined)
            updateData.id_institucion = input.id_institucion ? parseInt(String(input.id_institucion)) : null;
        if (input.id_estado !== undefined && input.id_estado)
            updateData.id_estado = parseInt(String(input.id_estado));
        const comunicacion = await db_1.default.comunicacion.update({
            where: { id_comunicacion: id },
            data: updateData,
            include: { congregacion: true, institucion: true, estado: true },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(comunicacion, "Comunicación actualizada correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al actualizar comunicación", error));
    }
});
// PATCH marcar como enviada
router.patch("/:id/enviar", auth_1.authenticateToken, (0, permissions_1.requirePermission)("comunicaciones", "actualizar"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.comunicacion.findFirst({ where: { id_comunicacion: id, ...congregacionFilter } });
        if (!existing)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Comunicación no encontrada"));
        const estadoEnviada = await (0, estados_1.getEstadoByCodigo)("COMUNICACION", "ENVIADA");
        if (!estadoEnviada)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'ENVIADA' no encontrado"));
        const comunicacion = await db_1.default.comunicacion.update({
            where: { id_comunicacion: id },
            data: { id_estado: estadoEnviada.id_estado, fecha_envio: new Date() },
            include: { congregacion: true, institucion: true, estado: true },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(comunicacion, "Comunicación marcada como enviada"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al enviar comunicación", error));
    }
});
router.delete("/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("comunicaciones", "eliminar"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.comunicacion.findFirst({ where: { id_comunicacion: id, ...congregacionFilter } });
        if (!existing)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Comunicación no encontrada"));
        const estadoAnulada = await (0, estados_1.getEstadoByCodigo)("COMUNICACION", "ANULADA");
        if (!estadoAnulada)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'ANULADA' no encontrado"));
        await db_1.default.comunicacion.update({ where: { id_comunicacion: id }, data: { id_estado: estadoAnulada.id_estado } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted("Comunicación anulada correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al anular comunicación", error));
    }
});
exports.default = router;
//# sourceMappingURL=comunicaciones.js.map