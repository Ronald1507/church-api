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
// Listado de tipos de relación familiar
router.get("/listado/tipos", auth_1.authenticateToken, (0, permissions_1.requirePermission)("familia", "leer"), async (req, res) => {
    try {
        const tipos = await db_1.default.tipoRelacionFamiliar.findMany({ orderBy: { nombre: "asc" } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(tipos));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener tipos de relación", error));
    }
});
// Listado de miembros para selects (scoped por congregación)
router.get("/listado/miembros", auth_1.authenticateToken, (0, permissions_1.requirePermission)("familia", "leer"), async (req, res) => {
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
// CRUD RELACIONES FAMILIARES
// ============================================
// GET todas las relaciones (scope por congregación del miembro origen)
router.get("/", auth_1.authenticateToken, (0, permissions_1.requirePermission)("familia", "leer"), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const relaciones = await db_1.default.relacionFamiliar.findMany({
            where: { miembroOrigen: { ...congregacionFilter } },
            take: 200,
            include: {
                miembroOrigen: { select: { id_miembro: true, nombres: true, apellidos: true } },
                miembroDestino: { select: { id_miembro: true, nombres: true, apellidos: true } },
                tipoRelacion: true,
            },
            orderBy: { fecha_registro: "desc" },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(relaciones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener relaciones familiares", error));
    }
});
// GET relaciones de un miembro (como origen o destino)
router.get("/miembro/:idMiembro", auth_1.authenticateToken, (0, permissions_1.requirePermission)("familia", "leer"), async (req, res) => {
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
        const relaciones = await db_1.default.relacionFamiliar.findMany({
            where: { OR: [{ id_miembro_origen: idMiembro }, { id_miembro_destino: idMiembro }] },
            include: {
                miembroOrigen: { select: { id_miembro: true, nombres: true, apellidos: true } },
                miembroDestino: { select: { id_miembro: true, nombres: true, apellidos: true } },
                tipoRelacion: true,
            },
            orderBy: { fecha_registro: "desc" },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(relaciones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al obtener relaciones del miembro", error));
    }
});
// POST crear relación familiar
router.post("/", auth_1.authenticateToken, (0, permissions_1.requirePermission)("familia", "crear"), async (req, res) => {
    try {
        const { id_miembro_origen, id_miembro_destino, id_tipo_relacion } = req.body;
        if (!id_miembro_origen || !id_miembro_destino || !id_tipo_relacion) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("Faltan campos requeridos"));
        }
        if (parseInt(String(id_miembro_origen)) === parseInt(String(id_miembro_destino))) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("Un miembro no puede relacionarse consigo mismo"));
        }
        // Verificar que ambos miembros existen y son accesibles
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const origen = await db_1.default.miembro.findFirst({ where: { id_miembro: parseInt(String(id_miembro_origen)), ...congregacionFilter } });
        const destino = await db_1.default.miembro.findFirst({ where: { id_miembro: parseInt(String(id_miembro_destino)), ...congregacionFilter } });
        if (!origen || !destino) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Uno o ambos miembros no existen o no son accesibles"));
        }
        const nueva = await db_1.default.relacionFamiliar.create({
            data: {
                id_miembro_origen: parseInt(String(id_miembro_origen)),
                id_miembro_destino: parseInt(String(id_miembro_destino)),
                id_tipo_relacion: parseInt(String(id_tipo_relacion)),
            },
            include: {
                miembroOrigen: { select: { id_miembro: true, nombres: true, apellidos: true } },
                miembroDestino: { select: { id_miembro: true, nombres: true, apellidos: true } },
                tipoRelacion: true,
            },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(nueva, "Relación familiar creada correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al crear relación familiar", error));
    }
});
// PUT actualizar tipo de relación
router.put("/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("familia", "actualizar"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.relacionFamiliar.findFirst({ where: { id, miembroOrigen: { ...congregacionFilter } } });
        if (!existing) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Relación no encontrada"));
        }
        const { id_tipo_relacion } = req.body;
        if (!id_tipo_relacion) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("Falta el tipo de relación"));
        }
        const actualizada = await db_1.default.relacionFamiliar.update({
            where: { id },
            data: { id_tipo_relacion: parseInt(String(id_tipo_relacion)) },
            include: {
                miembroOrigen: { select: { id_miembro: true, nombres: true, apellidos: true } },
                miembroDestino: { select: { id_miembro: true, nombres: true, apellidos: true } },
                tipoRelacion: true,
            },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(actualizada, "Relación familiar actualizada correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al actualizar relación familiar", error));
    }
});
// DELETE relación (eliminación física: no tiene estado)
router.delete("/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("familia", "eliminar"), async (req, res) => {
    try {
        const id = getNumericId(req.params.id);
        if (id === null) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError("ID inválido"));
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.relacionFamiliar.findFirst({ where: { id, miembroOrigen: { ...congregacionFilter } } });
        if (!existing) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound("Relación no encontrada"));
        }
        await db_1.default.relacionFamiliar.delete({ where: { id } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted("Relación familiar eliminada correctamente"));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Error al eliminar relación familiar", error));
    }
});
exports.default = router;
//# sourceMappingURL=familia.js.map