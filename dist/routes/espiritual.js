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
// ============================================
// LISTADOS
// ============================================
// Listado de tipos de hito espiritual
router.get("/listado/tipos", auth_1.authenticateToken, (0, permissions_1.requirePermission)("espiritual", "leer"), async (req, res) => {
    try {
        const tipos = await db_1.default.tipoHito.findMany({ orderBy: { nombre: "asc" } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(tipos));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener tipos de hito", error));
    }
});
// Listado de miembros para selects (scoped por congregación)
router.get("/listado/miembros", auth_1.authenticateToken, (0, permissions_1.requirePermission)("espiritual", "leer"), async (req, res) => {
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
// CRUD TIPOS DE HITO (catálogo)
// ============================================
router.post("/tipos", auth_1.authenticateToken, (0, permissions_1.requirePermission)("espiritual", "crear"), async (req, res) => {
    try {
        const { nombre, descripcion, requiere_ministro, genera_documento } = req.body;
        if (!nombre) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("El nombre es requerido"));
        }
        const tipo = await db_1.default.tipoHito.create({
            data: {
                nombre,
                descripcion: descripcion || null,
                requiere_ministro: requiere_ministro ?? true,
                genera_documento: genera_documento ?? false,
            },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(tipo, "Tipo de hito creado correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al crear tipo de hito", error));
    }
});
// ============================================
// CRUD HISTORIAL ESPIRITUAL
// ============================================
// GET todo el historial (scope por congregación del miembro)
router.get("/", auth_1.authenticateToken, (0, permissions_1.requirePermission)("espiritual", "leer"), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const historial = await db_1.default.historialEspiritual.findMany({
            where: { miembro: { ...congregacionFilter } },
            take: 200,
            include: {
                miembro: { select: { id_miembro: true, nombres: true, apellidos: true } },
                tipoHito: true,
            },
            orderBy: { fecha_hito: "desc" },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(historial));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener historial espiritual", error));
    }
});
// GET historial de un miembro
router.get("/miembro/:idMiembro", auth_1.authenticateToken, (0, permissions_1.requirePermission)("espiritual", "leer"), async (req, res) => {
    try {
        const idMiembro = getNumericId(req.params.idMiembro);
        if (idMiembro === null) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID de miembro inválido"));
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const miembro = await db_1.default.miembro.findFirst({ where: { id_miembro: idMiembro, ...congregacionFilter } });
        if (!miembro) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Miembro no encontrado"));
        }
        const historial = await db_1.default.historialEspiritual.findMany({
            where: { id_miembro: idMiembro },
            include: { tipoHito: true },
            orderBy: { fecha_hito: "desc" },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(historial));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener historial del miembro", error));
    }
});
// GET hito por ID
router.get("/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("espiritual", "leer"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const hito = await db_1.default.historialEspiritual.findFirst({
            where: { id_hito: id, miembro: { ...congregacionFilter } },
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, tipoHito: true },
        });
        if (!hito) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Hito no encontrado"));
        }
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(hito));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener hito", error));
    }
});
// POST crear hito
router.post("/", auth_1.authenticateToken, (0, permissions_1.requirePermission)("espiritual", "crear"), async (req, res) => {
    try {
        const { id_miembro, id_tipo_hito, fecha_hito, lugar, id_ministro, observaciones, documento_url } = req.body;
        if (!id_miembro || !id_tipo_hito || !fecha_hito) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("Faltan campos requeridos"));
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const miembro = await db_1.default.miembro.findFirst({ where: { id_miembro: parseInt(String(id_miembro)), ...congregacionFilter } });
        if (!miembro) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Miembro no encontrado o no accesible"));
        }
        const hito = await db_1.default.historialEspiritual.create({
            data: {
                id_miembro: parseInt(String(id_miembro)),
                id_tipo_hito: parseInt(String(id_tipo_hito)),
                fecha_hito: new Date(fecha_hito),
                lugar: lugar || null,
                id_ministro: id_ministro ? parseInt(String(id_ministro)) : null,
                observaciones: observaciones || null,
                documento_url: documento_url || null,
            },
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, tipoHito: true },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(hito, "Hito espiritual registrado correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al registrar hito espiritual", error));
    }
});
// PUT actualizar hito
router.put("/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("espiritual", "actualizar"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.historialEspiritual.findFirst({ where: { id_hito: id, miembro: { ...congregacionFilter } } });
        if (!existing) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Hito no encontrado"));
        }
        const input = req.body;
        const updateData = {};
        if (input.id_tipo_hito !== undefined)
            updateData.id_tipo_hito = parseInt(String(input.id_tipo_hito));
        if (input.fecha_hito !== undefined && input.fecha_hito)
            updateData.fecha_hito = new Date(input.fecha_hito);
        if (input.lugar !== undefined)
            updateData.lugar = input.lugar || null;
        if (input.id_ministro !== undefined)
            updateData.id_ministro = input.id_ministro ? parseInt(String(input.id_ministro)) : null;
        if (input.observaciones !== undefined)
            updateData.observaciones = input.observaciones || null;
        if (input.documento_url !== undefined)
            updateData.documento_url = input.documento_url || null;
        const hito = await db_1.default.historialEspiritual.update({
            where: { id_hito: id },
            data: updateData,
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, tipoHito: true },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(hito, "Hito espiritual actualizado correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al actualizar hito espiritual", error));
    }
});
// DELETE hito (eliminación física: no tiene estado)
router.delete("/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("espiritual", "eliminar"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.historialEspiritual.findFirst({ where: { id_hito: id, miembro: { ...congregacionFilter } } });
        if (!existing) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Hito no encontrado"));
        }
        await db_1.default.historialEspiritual.delete({ where: { id_hito: id } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted("Hito espiritual eliminado correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al eliminar hito espiritual", error));
    }
});
exports.default = router;
//# sourceMappingURL=espiritual.js.map