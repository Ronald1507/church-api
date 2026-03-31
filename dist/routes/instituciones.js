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
// Get all instituciones
router.get('/', async (req, res) => {
    try {
        const instituciones = await db_1.default.institucion.findMany({
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
// Get institucion by ID
router.get('/:id', async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const institucion = await db_1.default.institucion.findUnique({
            where: { id_institucion: id },
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
router.post('/', async (req, res) => {
    try {
        const { nombre, tipo, descripcion, id_congregacion, id_estado } = req.body;
        if (!nombre || !id_congregacion || !id_estado) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        const newInstitucion = await db_1.default.institucion.create({
            data: {
                nombre,
                tipo,
                descripcion,
                id_congregacion,
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
router.put('/:id', async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const updateData = { ...req.body };
        delete updateData.id_institucion;
        delete updateData.created_at;
        delete updateData.updated_at;
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
router.delete('/:id', async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
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
router.get('/meta', async (req, res) => {
    try {
        const [estados, congregaciones] = await Promise.all([
            db_1.default.estado.findMany({
                where: { entidad: 'INSTITUCION' },
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
//# sourceMappingURL=instituciones.js.map