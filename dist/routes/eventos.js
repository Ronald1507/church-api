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
// Get all eventos - filtrado por congregación
router.get('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const eventos = await db_1.default.evento.findMany({
            where: congregacionFilter,
            include: {
                congregacion: true,
                estado: true
            },
            orderBy: { fecha_inicio: 'desc' }
        });
        res.json(eventos);
    }
    catch (error) {
        console.error('Error getting eventos:', error);
        res.status(500).json({ error: 'Error al obtener eventos' });
    }
});
// Get evento by ID - filtrado por congregación
router.get('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const evento = await db_1.default.evento.findFirst({
            where: {
                id_evento: id,
                ...congregacionFilter
            },
            include: {
                congregacion: true,
                estado: true,
                asistencia: {
                    include: { miembro: true }
                }
            }
        });
        if (!evento) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        res.json(evento);
    }
    catch (error) {
        console.error('Error getting evento:', error);
        res.status(500).json({ error: 'Error al obtener evento' });
    }
});
// Create evento
router.post('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'crear'), async (req, res) => {
    try {
        const { nombre, tipo, descripcion, fecha_inicio, fecha_fin, lugar, id_congregacion, capacidad_max, id_estado } = req.body;
        if (!nombre || !fecha_inicio || !id_estado) {
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
        const newEvento = await db_1.default.evento.create({
            data: {
                nombre,
                tipo,
                descripcion,
                fecha_inicio: new Date(fecha_inicio),
                fecha_fin: fecha_fin ? new Date(fecha_fin) : null,
                lugar,
                id_congregacion: congregacionId,
                capacidad_max: capacidad_max ? parseInt(capacidad_max) : null,
                id_estado
            },
            include: {
                congregacion: true,
                estado: true
            }
        });
        res.status(201).json(newEvento);
    }
    catch (error) {
        console.error('Error creating evento:', error);
        res.status(500).json({ error: 'Error al crear evento' });
    }
});
// Update evento
router.put('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        // Verificar que el evento pertenezca a la congregación del usuario
        const existingEvento = await db_1.default.evento.findFirst({
            where: {
                id_evento: id,
                ...congregacionFilter
            }
        });
        if (!existingEvento) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        const updateData = { ...req.body };
        delete updateData.id_evento;
        delete updateData.created_at;
        delete updateData.updated_at;
        // Convert dates
        if (updateData.fecha_inicio) {
            updateData.fecha_inicio = new Date(updateData.fecha_inicio);
        }
        if (updateData.fecha_fin) {
            updateData.fecha_fin = new Date(updateData.fecha_fin);
        }
        // Si no es admin, no permitir cambiar la congregación
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN' && updateData.id_congregacion) {
            delete updateData.id_congregacion;
        }
        const updatedEvento = await db_1.default.evento.update({
            where: { id_evento: id },
            data: updateData,
            include: {
                congregacion: true,
                estado: true
            }
        });
        res.json(updatedEvento);
    }
    catch (error) {
        console.error('Error updating evento:', error);
        res.status(500).json({ error: 'Error al actualizar evento' });
    }
});
// Delete evento
router.delete('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        // Verificar que el evento pertenezca a la congregación del usuario
        const existingEvento = await db_1.default.evento.findFirst({
            where: {
                id_evento: id,
                ...congregacionFilter
            }
        });
        if (!existingEvento) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        await db_1.default.evento.delete({
            where: { id_evento: id }
        });
        res.json({ message: 'Evento eliminado correctamente' });
    }
    catch (error) {
        console.error('Error deleting evento:', error);
        res.status(500).json({ error: 'Error al eliminar evento' });
    }
});
// Get metadata for evento form
router.get('/meta', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'leer'), async (req, res) => {
    try {
        let congregacionFilter = {};
        const { nivel } = req.user || {};
        // Si no es admin, solo puede ver su congregación
        if (nivel !== 'ADMIN' && req.user?.id_congregacion) {
            congregacionFilter = { id_congregacion: req.user.id_congregacion };
        }
        const [estados, congregaciones] = await Promise.all([
            db_1.default.estado.findMany({
                where: { entidad: 'EVENTO' },
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
//# sourceMappingURL=eventos.js.map