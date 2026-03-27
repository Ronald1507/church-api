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
// Get all congregaciones
router.get('/', async (req, res) => {
    try {
        const congregaciones = await db_1.default.congregacion.findMany({
            include: {
                estado: true
            },
            orderBy: { nombre: 'asc' }
        });
        res.json(congregaciones);
    }
    catch (error) {
        console.error('Error getting congregaciones:', error);
        res.status(500).json({ error: 'Error al obtener congregaciones' });
    }
});
// Get congregacion by ID
router.get('/:id', async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const congregacion = await db_1.default.congregacion.findUnique({
            where: { id_congregacion: id },
            include: {
                estado: true,
                ministerios: true,
                miembros: true,
                institucions: true,
                eventos: true,
                finanzasCuentas: true,
                inventarioItems: true,
                presupuestos: true,
                comunicaciones: true
            }
        });
        if (!congregacion) {
            return res.status(404).json({ error: 'Congregación no encontrada' });
        }
        res.json(congregacion);
    }
    catch (error) {
        console.error('Error getting congregacion:', error);
        res.status(500).json({ error: 'Error al obtener congregación' });
    }
});
// Create congregacion
router.post('/', async (req, res) => {
    try {
        const { nombre, direccion, ciudad, region, id_pastor, telefono, email, id_estado } = req.body;
        if (!nombre || !id_estado) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        const newCongregacion = await db_1.default.congregacion.create({
            data: {
                nombre,
                direccion,
                ciudad,
                region,
                id_pastor,
                telefono,
                email,
                id_estado
            },
            include: {
                estado: true
            }
        });
        res.status(201).json(newCongregacion);
    }
    catch (error) {
        console.error('Error creating congregacion:', error);
        res.status(500).json({ error: 'Error al crear congregación' });
    }
});
// Update congregacion
router.put('/:id', async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const updateData = { ...req.body };
        delete updateData.id_congregacion;
        delete updateData.created_at;
        delete updateData.updated_at;
        const updatedCongregacion = await db_1.default.congregacion.update({
            where: { id_congregacion: id },
            data: updateData,
            include: {
                estado: true
            }
        });
        res.json(updatedCongregacion);
    }
    catch (error) {
        console.error('Error updating congregacion:', error);
        res.status(500).json({ error: 'Error al actualizar congregación' });
    }
});
// Delete congregacion
router.delete('/:id', async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        await db_1.default.congregacion.delete({
            where: { id_congregacion: id }
        });
        res.json({ message: 'Congregación eliminada correctamente' });
    }
    catch (error) {
        console.error('Error deleting congregacion:', error);
        res.status(500).json({ error: 'Error al eliminar congregación' });
    }
});
exports.default = router;
//# sourceMappingURL=congregaciones.js.map