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
router.get("/listado/estados/visita", auth_1.authenticateToken, (0, permissions_1.requirePermission)("pastoral", "leer"), async (req, res) => {
    try {
        const estados = await db_1.default.estado.findMany({ where: { entidad: "VISITA_PASTORAL" }, orderBy: { nombre: "asc" } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(estados));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener estados de visita", error));
    }
});
router.get("/listado/estados/peticion", auth_1.authenticateToken, (0, permissions_1.requirePermission)("pastoral", "leer"), async (req, res) => {
    try {
        const estados = await db_1.default.estado.findMany({ where: { entidad: "PETICION_ORACION" }, orderBy: { nombre: "asc" } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(estados));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener estados de petición", error));
    }
});
router.get("/listado/miembros", auth_1.authenticateToken, (0, permissions_1.requirePermission)("pastoral", "leer"), async (req, res) => {
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
// CRUD VISITAS PASTORALES
// ============================================
router.get("/visitas", auth_1.authenticateToken, (0, permissions_1.requirePermission)("pastoral", "leer"), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const visitas = await db_1.default.visitaPastoral.findMany({
            where: { miembro: { ...congregacionFilter } },
            take: 200,
            include: {
                miembro: { select: { id_miembro: true, nombres: true, apellidos: true } },
                pastor: { select: { id_miembro: true, nombres: true, apellidos: true } },
                estado: true,
            },
            orderBy: { fecha_visita: "desc" },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(visitas));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener visitas pastorales", error));
    }
});
router.get("/visitas/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("pastoral", "leer"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const visita = await db_1.default.visitaPastoral.findFirst({
            where: { id_visita: id, miembro: { ...congregacionFilter } },
            include: {
                miembro: { select: { id_miembro: true, nombres: true, apellidos: true } },
                pastor: { select: { id_miembro: true, nombres: true, apellidos: true } },
                estado: true,
            },
        });
        if (!visita)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Visita no encontrada"));
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(visita));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener visita", error));
    }
});
router.post("/visitas", auth_1.authenticateToken, (0, permissions_1.requirePermission)("pastoral", "crear"), async (req, res) => {
    try {
        const { id_miembro, id_pastor, fecha_visita, motivo, observaciones, resultado, id_estado } = req.body;
        if (!id_miembro || !id_pastor || !fecha_visita || !motivo) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("Faltan campos requeridos"));
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const miembro = await db_1.default.miembro.findFirst({ where: { id_miembro: parseInt(String(id_miembro)), ...congregacionFilter } });
        if (!miembro)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Miembro no encontrado o no accesible"));
        let estadoId = id_estado ? parseInt(String(id_estado)) : null;
        if (!estadoId) {
            const estadoProgramada = await (0, estados_1.getEstadoByCodigo)("VISITA_PASTORAL", "PROGRAMADA");
            if (!estadoProgramada)
                return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'PROGRAMADA' no encontrado. Ejecute el seed de estados."));
            estadoId = estadoProgramada.id_estado;
        }
        const visita = await db_1.default.visitaPastoral.create({
            data: {
                id_miembro: parseInt(String(id_miembro)),
                id_pastor: parseInt(String(id_pastor)),
                fecha_visita: new Date(fecha_visita),
                motivo,
                observaciones: observaciones || null,
                resultado: resultado || null,
                id_estado: estadoId,
            },
            include: {
                miembro: { select: { id_miembro: true, nombres: true, apellidos: true } },
                pastor: { select: { id_miembro: true, nombres: true, apellidos: true } },
                estado: true,
            },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(visita, "Visita pastoral registrada correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al registrar visita pastoral", error));
    }
});
router.put("/visitas/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("pastoral", "actualizar"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.visitaPastoral.findFirst({ where: { id_visita: id, miembro: { ...congregacionFilter } } });
        if (!existing)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Visita no encontrada"));
        const input = req.body;
        const updateData = {};
        if (input.id_pastor !== undefined)
            updateData.id_pastor = parseInt(String(input.id_pastor));
        if (input.fecha_visita !== undefined && input.fecha_visita)
            updateData.fecha_visita = new Date(input.fecha_visita);
        if (input.motivo !== undefined)
            updateData.motivo = input.motivo;
        if (input.observaciones !== undefined)
            updateData.observaciones = input.observaciones || null;
        if (input.resultado !== undefined)
            updateData.resultado = input.resultado || null;
        if (input.id_estado !== undefined && input.id_estado)
            updateData.id_estado = parseInt(String(input.id_estado));
        const visita = await db_1.default.visitaPastoral.update({
            where: { id_visita: id },
            data: updateData,
            include: {
                miembro: { select: { id_miembro: true, nombres: true, apellidos: true } },
                pastor: { select: { id_miembro: true, nombres: true, apellidos: true } },
                estado: true,
            },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(visita, "Visita pastoral actualizada correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al actualizar visita pastoral", error));
    }
});
router.delete("/visitas/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("pastoral", "eliminar"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.visitaPastoral.findFirst({ where: { id_visita: id, miembro: { ...congregacionFilter } } });
        if (!existing)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Visita no encontrada"));
        const estadoCancelada = await (0, estados_1.getEstadoByCodigo)("VISITA_PASTORAL", "CANCELADA");
        if (!estadoCancelada)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'CANCELADA' no encontrado"));
        await db_1.default.visitaPastoral.update({ where: { id_visita: id }, data: { id_estado: estadoCancelada.id_estado } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted("Visita pastoral cancelada correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al cancelar visita pastoral", error));
    }
});
// ============================================
// CRUD PETICIONES DE ORACIÓN
// ============================================
router.get("/peticiones", auth_1.authenticateToken, (0, permissions_1.requirePermission)("pastoral", "leer"), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const peticiones = await db_1.default.peticionOracion.findMany({
            where: { miembro: { ...congregacionFilter } },
            take: 200,
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
            orderBy: { fecha_solicitud: "desc" },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(peticiones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener peticiones de oración", error));
    }
});
router.get("/peticiones/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("pastoral", "leer"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const peticion = await db_1.default.peticionOracion.findFirst({
            where: { id_peticion: id, miembro: { ...congregacionFilter } },
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
        });
        if (!peticion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Petición no encontrada"));
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(peticion));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener petición", error));
    }
});
router.post("/peticiones", auth_1.authenticateToken, (0, permissions_1.requirePermission)("pastoral", "crear"), async (req, res) => {
    try {
        const { id_miembro, descripcion, categoria, privacidad, id_estado } = req.body;
        if (!id_miembro || !descripcion) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("Faltan campos requeridos"));
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const miembro = await db_1.default.miembro.findFirst({ where: { id_miembro: parseInt(String(id_miembro)), ...congregacionFilter } });
        if (!miembro)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Miembro no encontrado o no accesible"));
        let estadoId = id_estado ? parseInt(String(id_estado)) : null;
        if (!estadoId) {
            const estadoActiva = await (0, estados_1.getEstadoByCodigo)("PETICION_ORACION", "ACTIVA");
            if (!estadoActiva)
                return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'ACTIVA' no encontrado. Ejecute el seed de estados."));
            estadoId = estadoActiva.id_estado;
        }
        const peticion = await db_1.default.peticionOracion.create({
            data: {
                id_miembro: parseInt(String(id_miembro)),
                descripcion,
                categoria: categoria || null,
                privacidad: privacidad || "privada",
                id_estado: estadoId,
            },
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(peticion, "Petición de oración registrada correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al registrar petición de oración", error));
    }
});
router.put("/peticiones/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("pastoral", "actualizar"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.peticionOracion.findFirst({ where: { id_peticion: id, miembro: { ...congregacionFilter } } });
        if (!existing)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Petición no encontrada"));
        const input = req.body;
        const updateData = {};
        if (input.descripcion !== undefined)
            updateData.descripcion = input.descripcion;
        if (input.categoria !== undefined)
            updateData.categoria = input.categoria || null;
        if (input.privacidad !== undefined)
            updateData.privacidad = input.privacidad;
        if (input.testimonio !== undefined)
            updateData.testimonio = input.testimonio || null;
        if (input.fecha_cierre !== undefined)
            updateData.fecha_cierre = input.fecha_cierre ? new Date(input.fecha_cierre) : null;
        if (input.id_estado !== undefined && input.id_estado)
            updateData.id_estado = parseInt(String(input.id_estado));
        const peticion = await db_1.default.peticionOracion.update({
            where: { id_peticion: id },
            data: updateData,
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(peticion, "Petición de oración actualizada correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al actualizar petición de oración", error));
    }
});
router.delete("/peticiones/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("pastoral", "eliminar"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.peticionOracion.findFirst({ where: { id_peticion: id, miembro: { ...congregacionFilter } } });
        if (!existing)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Petición no encontrada"));
        const estadoCerrada = await (0, estados_1.getEstadoByCodigo)("PETICION_ORACION", "CERRADA");
        if (!estadoCerrada)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'CERRADA' no encontrado"));
        await db_1.default.peticionOracion.update({
            where: { id_peticion: id },
            data: { id_estado: estadoCerrada.id_estado, fecha_cierre: new Date() },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted("Petición de oración cerrada correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al cerrar petición de oración", error));
    }
});
exports.default = router;
//# sourceMappingURL=pastoral.js.map