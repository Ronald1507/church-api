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
    const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
    return isNaN(num) ? null : num;
};
// Get all instituciones - filtrado por congregación
router.get('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const instituciones = await db_1.default.institucion.findMany({
            where: congregacionFilter,
            include: {
                congregacion: true,
                estado: true
            },
            orderBy: { nombre: 'asc' }
        });
        res.json(instituciones);
    }
    catch (error) {
        console.error('Error getting instituciones:', error);
        res.status(500).json({ error: 'Error al obtener instituciones' });
    }
});
// Get institucion by ID - filtrado por congregación
router.get('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const institucion = await db_1.default.institucion.findFirst({
            where: {
                id_institucion: id,
                ...congregacionFilter
            },
            include: {
                congregacion: true,
                estado: true,
                miembroInstitucions: {
                    include: { miembro: true, estado: true }
                }
            }
        });
        if (!institucion) {
            return res.status(404).json({ error: 'Institución no encontrada' });
        }
        res.json(institucion);
    }
    catch (error) {
        console.error('Error getting institucion:', error);
        res.status(500).json({ error: 'Error al obtener institución' });
    }
});
// Create institucion
router.post('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'crear'), async (req, res) => {
    try {
        const { nombre, tipo, descripcion, id_congregacion, id_estado } = req.body;
        if (!nombre || !id_estado) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        // Si no es admin, forzar la congregación del usuario
        let congregacionId = id_congregacion;
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN' && req.user?.id_congregacion) {
            congregacionId = req.user.id_congregacion;
        }
        if (!congregacionId) {
            return res.status(400).json({ error: 'Debe especificar una congregación' });
        }
        const newInstitucion = await db_1.default.institucion.create({
            data: {
                nombre,
                tipo,
                descripcion,
                id_congregacion: congregacionId,
                id_estado
            },
            include: {
                congregacion: true,
                estado: true
            }
        });
        res.status(201).json(newInstitucion);
    }
    catch (error) {
        console.error('Error creating institucion:', error);
        res.status(500).json({ error: 'Error al crear institución' });
    }
});
// Update institucion
router.put('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        // Verificar que la institucion pertenezca a la congregación del usuario
        const existingInstitucion = await db_1.default.institucion.findFirst({
            where: {
                id_institucion: id,
                ...congregacionFilter
            }
        });
        if (!existingInstitucion) {
            return res.status(404).json({ error: 'Institución no encontrada' });
        }
        const updateData = { ...req.body };
        delete updateData.id_institucion;
        delete updateData.created_at;
        delete updateData.updated_at;
        // Si no es admin, no permitir cambiar la congregación
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN' && updateData.id_congregacion) {
            delete updateData.id_congregacion;
        }
        const updatedInstitucion = await db_1.default.institucion.update({
            where: { id_institucion: id },
            data: updateData,
            include: {
                congregacion: true,
                estado: true
            }
        });
        res.json(updatedInstitucion);
    }
    catch (error) {
        console.error('Error updating institucion:', error);
        res.status(500).json({ error: 'Error al actualizar institución' });
    }
});
// Delete institucion
router.delete('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        // Verificar que la institucion pertenezca a la congregación del usuario
        const existingInstitucion = await db_1.default.institucion.findFirst({
            where: {
                id_institucion: id,
                ...congregacionFilter
            }
        });
        if (!existingInstitucion) {
            return res.status(404).json({ error: 'Institución no encontrada' });
        }
        await db_1.default.institucion.delete({
            where: { id_institucion: id }
        });
        res.json({ message: 'Institución eliminada correctamente' });
    }
    catch (error) {
        console.error('Error deleting institucion:', error);
        res.status(500).json({ error: 'Error al eliminar institución' });
    }
});
// Get metadata for institucion form
router.get('/meta', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'leer'), async (req, res) => {
    try {
        let congregacionFilter = {};
        const { nivel } = req.user || {};
        // Si no es admin, solo puede ver su congregación
        if (nivel !== 'ADMIN' && req.user?.id_congregacion) {
            congregacionFilter = { id_congregacion: req.user.id_congregacion };
        }
        const [estados, congregaciones] = await Promise.all([
            db_1.default.estado.findMany({
                where: { entidad: 'INSTITUCION' },
                orderBy: { nombre: 'asc' }
            }),
            db_1.default.congregacion.findMany({
                where: congregacionFilter,
                include: { estado: true },
                orderBy: { nombre: 'asc' }
            })
        ]);
        res.json({ estados, congregaciones });
    }
    catch (error) {
        console.error('Get metadata error:', error);
        res.status(500).json({ error: 'Error al obtener metadatos' });
    }
});
exports.default = router;
//# sourceMappingURL=instituciones.js.map