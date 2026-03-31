"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
const router = (0, express_1.Router)();
// Helper to get numeric ID from params
const getId = (req) => {
    const id = req.params.id;
    const num = typeof id === "string" ? parseInt(id) : parseInt(id?.[0] || "");
    return isNaN(num) ? null : num;
};
// Get member types
router.get("/meta/tipos", auth_1.authenticateToken, (0, permissions_1.requirePermission)("miembros", "leer"), async (req, res) => {
    try {
        const tipos = await db_1.default.tipoMiembro.findMany({
            orderBy: { nombre: "asc" },
        });
        res.json(tipos);
    }
    catch (error) {
        res.status(500).json({
            error: "Error al obtener tipos de miembro",
        });
    }
});
// Get metadata for member form (estados, congregaciones, tipos)
// Para no-admin, solo devuelve su congregación
router.get("/opciones", auth_1.authenticateToken, (0, permissions_1.requirePermission)("miembros", "leer"), async (req, res) => {
    try {
        let congregacionFilter = {};
        const { nivel } = req.user || {};
        // Si no es admin, solo puede ver su congregación
        if (nivel !== "ADMIN" && req.user?.id_congregacion) {
            congregacionFilter = {
                id_congregacion: req.user.id_congregacion,
            };
        }
        const [estados, congregaciones, tipos, ministerios] = await Promise.all([
            db_1.default.estado.findMany({
                where: { entidad: "MIEMBRO" },
                orderBy: { nombre: "asc" },
            }),
            db_1.default.congregacion.findMany({
                where: congregacionFilter,
                include: { estado: true },
                orderBy: { nombre: "asc" },
            }),
            db_1.default.tipoMiembro.findMany({
                orderBy: { nombre: "asc" },
            }),
            db_1.default.ministerio.findMany({
                where: congregacionFilter,
                include: { estado: true },
                orderBy: { nombre: "asc" },
            }),
        ]);
        res.json({ estados, congregaciones, tipos, ministerios });
    }
    catch (error) {
        console.error("Get metadata error:", error);
        res.status(500).json({ error: "Error al obtener metadatos" });
    }
});
// Get all members - MINIMAL WITH LOGGING
router.get("/", auth_1.authenticateToken, (0, permissions_1.requirePermission)("miembros", "leer"), async (req, res) => {
    console.log("GET /miembros called - user:", req.user);
    try {
        const miembros = await db_1.default.miembro.findMany({ take: 10 });
        console.log("Found:", miembros.length);
        res.json(miembros);
    }
    catch (error) {
        const err = error;
        console.error("Error:", err.message);
        res.status(500).json({ error: "Error al obtener miembros" });
    }
});
// Get member by ID - filtrado por congregación
router.get("/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("miembros", "leer"), async (req, res) => {
    try {
        const memberId = getId(req);
        if (memberId === null) {
            return res
                .status(400)
                .json({ error: "ID de miembro inválido" });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const miembro = await db_1.default.miembro.findFirst({
            where: {
                id_miembro: memberId,
                ...congregacionFilter,
            },
            include: {
                estado: true,
                congregacion: true,
                tipoMiembro: true,
                ministry: true,
                cargoMinisterials: {
                    include: { ministry: true, estado: true },
                },
                relacionesOrigen: {
                    include: { miembroDestino: true, tipoRelacion: true },
                },
                relacionesDestino: {
                    include: { miembroOrigen: true, tipoRelacion: true },
                },
                historialEspirituals: {
                    include: { tipoHito: true },
                },
                visitaPastorals: true,
                peticionOraciones: true,
                miembroInstitucions: {
                    include: { institucion: true },
                },
                asistenciaEventos: {
                    include: { evento: true },
                },
                documentos: true,
                ofrendaDizmos: true,
            },
        });
        if (!miembro) {
            return res.status(404).json({ error: "Miembro no encontrado" });
        }
        res.json(miembro);
    }
    catch (error) {
        console.error("Get miembro error:", error);
        res.status(500).json({ error: "Error al obtener miembro" });
    }
});
// Create member
router.post("/", auth_1.authenticateToken, (0, permissions_1.requirePermission)("miembros", "crear"), async (req, res) => {
    try {
        const { nombres, apellidos, fecha_nacimiento, genero, estado_civil, rut, telefono, email, direccion, foto_url, id_estado, id_congregacion, id_ministerio, id_tipo_miembro, } = req.body;
        if (!nombres || !apellidos || !id_estado || !id_tipo_miembro) {
            return res
                .status(400)
                .json({ error: "Faltan campos requeridos" });
        }
        // Si no es admin, forzar la congregación del usuario
        let congregacionId = id_congregacion;
        const { nivel } = req.user || {};
        if (nivel !== "ADMIN" && req.user?.id_congregacion) {
            congregacionId = req.user.id_congregacion;
        }
        if (!congregacionId) {
            return res
                .status(400)
                .json({ error: "Debe especificar una congregación" });
        }
        const newMiembro = await db_1.default.miembro.create({
            data: {
                nombres,
                apellidos,
                fecha_nacimiento: fecha_nacimiento
                    ? new Date(fecha_nacimiento)
                    : null,
                genero,
                estado_civil,
                rut,
                telefono,
                email,
                direccion,
                foto_url,
                id_estado,
                id_congregacion: congregacionId,
                id_ministerio,
                id_tipo_miembro,
            },
            include: {
                estado: true,
                congregacion: true,
                tipoMiembro: true,
            },
        });
        res.status(201).json(newMiembro);
    }
    catch (error) {
        console.error("Create miembro error:", error);
        res.status(500).json({ error: "Error al crear miembro" });
    }
});
// Update member
router.put("/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("miembros", "actualizar"), async (req, res) => {
    try {
        const memberId = getId(req);
        if (memberId === null) {
            return res
                .status(400)
                .json({ error: "ID de miembro inválido" });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        // Verificar que el miembro pertenezca a la congregación del usuario
        const existingMiembro = await db_1.default.miembro.findFirst({
            where: {
                id_miembro: memberId,
                ...congregacionFilter,
            },
        });
        if (!existingMiembro) {
            return res.status(404).json({ error: "Miembro no encontrado" });
        }
        const updateData = { ...req.body };
        // Remove non-database fields
        delete updateData.id_miembro;
        delete updateData.created_at;
        delete updateData.updated_at;
        // Convert fecha_nacimiento if present
        if (updateData.fecha_nacimiento) {
            updateData.fecha_nacimiento = new Date(updateData.fecha_nacimiento);
        }
        // Si no es admin, no permitir cambiar la congregación
        const { nivel } = req.user || {};
        if (nivel !== "ADMIN" && updateData.id_congregacion) {
            delete updateData.id_congregacion;
        }
        const updatedMiembro = await db_1.default.miembro.update({
            where: { id_miembro: memberId },
            data: updateData,
            include: {
                estado: true,
                congregacion: true,
                tipoMiembro: true,
            },
        });
        res.json(updatedMiembro);
    }
    catch (error) {
        console.error("Update miembro error:", error);
        res.status(500).json({ error: "Error al actualizar miembro" });
    }
});
// Delete member
router.delete("/:id", auth_1.authenticateToken, (0, permissions_1.requirePermission)("miembros", "eliminar"), async (req, res) => {
    try {
        const memberId = getId(req);
        if (memberId === null) {
            return res
                .status(400)
                .json({ error: "ID de miembro inválido" });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        // Verificar que el miembro pertenezca a la congregación del usuario
        const existingMiembro = await db_1.default.miembro.findFirst({
            where: {
                id_miembro: memberId,
                ...congregacionFilter,
            },
        });
        if (!existingMiembro) {
            return res.status(404).json({ error: "Miembro no encontrado" });
        }
        await db_1.default.miembro.delete({
            where: { id_miembro: memberId },
        });
        res.json({ message: "Miembro eliminado correctamente" });
    }
    catch (error) {
        console.error("Delete miembro error:", error);
        res.status(500).json({ error: "Error al eliminar miembro" });
    }
});
// Get member types
// MOVED TO TOP - duplicates removed
exports.default = router;
//# sourceMappingURL=miembros.js.map