"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const router = (0, express_1.Router)();
// Helper to get numeric ID from params
const getId = (req) => {
    const id = req.params.id;
    const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
    return isNaN(num) ? null : num;
};
// Get all eventos
router.get('/', async (req, res) => {
    try {
        const eventos = await db_1.default.evento.findMany({
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
// Get evento by ID
router.get('/:id', async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const evento = await db_1.default.evento.findUnique({
            where: { id_evento: id },
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
router.post('/', async (req, res) => {
    try {
        const { nombre, tipo, descripcion, fecha_inicio, fecha_fin, lugar, id_congregacion, capacidad_max, id_estado } = req.body;
        if (!nombre || !fecha_inicio || !id_congregacion || !id_estado) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        const newEvento = await db_1.default.evento.create({
            data: {
                nombre,
                tipo,
                descripcion,
                fecha_inicio: new Date(fecha_inicio),
                fecha_fin: fecha_fin ? new Date(fecha_fin) : null,
                lugar,
                id_congregacion,
                capacidad_max,
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
router.put('/:id', async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
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
router.delete('/:id', async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
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
router.get('/meta', async (req, res) => {
    try {
        const [estados, congregaciones] = await Promise.all([
            db_1.default.estado.findMany({
                where: { entidad: 'EVENTO' },
                orderBy: { nombre: 'asc' }
            }),
            db_1.default.congregacion.findMany({
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