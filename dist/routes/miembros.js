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
// Get all members
router.get('/', async (req, res) => {
    try {
        const miembros = await db_1.default.miembro.findMany({
            include: {
                estado: true,
                congregacion: true,
                tipoMiembro: true,
                ministerio: true
            },
            orderBy: { apellidos: 'asc' }
        });
        res.json(miembros);
    }
    catch (error) {
        console.error('Get miembros error:', error);
        res.status(500).json({ error: 'Error al obtener miembros' });
    }
});
// Get member by ID
router.get('/:id', async (req, res) => {
    try {
        const memberId = getId(req);
        if (memberId === null) {
            return res.status(400).json({ error: 'ID de miembro inválido' });
        }
        const miembro = await db_1.default.miembro.findUnique({
            where: { id_miembro: memberId },
            include: {
                estado: true,
                congregacion: true,
                tipoMiembro: true,
                ministerio: true,
                cargoMinisterials: {
                    include: { ministerio: true, estado: true }
                },
                relacionesOrigen: {
                    include: { miembroDestino: true, tipoRelacion: true }
                },
                relacionesDestino: {
                    include: { miembroOrigen: true, tipoRelacion: true }
                },
                historialEspirituals: {
                    include: { tipoHito: true }
                },
                visitaPastorals: true,
                peticionOraciones: true,
                miembroInstitucions: {
                    include: { institucion: true }
                },
                asistenciaEventos: {
                    include: { evento: true }
                },
                documentos: true,
                ofrendaDizmos: true
            }
        });
        if (!miembro) {
            return res.status(404).json({ error: 'Miembro no encontrado' });
        }
        res.json(miembro);
    }
    catch (error) {
        console.error('Get miembro error:', error);
        res.status(500).json({ error: 'Error al obtener miembro' });
    }
});
// Create member
router.post('/', async (req, res) => {
    try {
        const { nombres, apellidos, fecha_nacimiento, genero, estado_civil, rut, telefono, email, direccion, foto_url, id_estado, id_congregacion, id_ministerio, id_tipo_miembro } = req.body;
        if (!nombres || !apellidos || !id_estado || !id_congregacion || !id_tipo_miembro) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        const newMiembro = await db_1.default.miembro.create({
            data: {
                nombres,
                apellidos,
                fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : null,
                genero,
                estado_civil,
                rut,
                telefono,
                email,
                direccion,
                foto_url,
                id_estado,
                id_congregacion,
                id_ministerio,
                id_tipo_miembro
            },
            include: {
                estado: true,
                congregacion: true,
                tipoMiembro: true
            }
        });
        res.status(201).json(newMiembro);
    }
    catch (error) {
        console.error('Create miembro error:', error);
        res.status(500).json({ error: 'Error al crear miembro' });
    }
});
// Update member
router.put('/:id', async (req, res) => {
    try {
        const memberId = getId(req);
        if (memberId === null) {
            return res.status(400).json({ error: 'ID de miembro inválido' });
        }
        const updateData = req.body;
        // Remove non-database fields
        delete updateData.id_miembro;
        delete updateData.created_at;
        delete updateData.updated_at;
        // Convert fecha_nacimiento if present
        if (updateData.fecha_nacimiento) {
            updateData.fecha_nacimiento = new Date(updateData.fecha_nacimiento);
        }
        const updatedMiembro = await db_1.default.miembro.update({
            where: { id_miembro: memberId },
            data: updateData,
            include: {
                estado: true,
                congregacion: true,
                tipoMiembro: true
            }
        });
        res.json(updatedMiembro);
    }
    catch (error) {
        console.error('Update miembro error:', error);
        res.status(500).json({ error: 'Error al actualizar miembro' });
    }
});
// Delete member
router.delete('/:id', async (req, res) => {
    try {
        const memberId = getId(req);
        if (memberId === null) {
            return res.status(400).json({ error: 'ID de miembro inválido' });
        }
        await db_1.default.miembro.delete({
            where: { id_miembro: memberId }
        });
        res.json({ message: 'Miembro eliminado correctamente' });
    }
    catch (error) {
        console.error('Delete miembro error:', error);
        res.status(500).json({ error: 'Error al eliminar miembro' });
    }
});
// Get member types
router.get('/meta/tipos', async (req, res) => {
    try {
        const tipos = await db_1.default.tipoMiembro.findMany({
            orderBy: { nombre: 'asc' }
        });
        res.json(tipos);
    }
    catch (error) {
        res.status(500).json({ error: 'Error al obtener tipos de miembro' });
    }
});
// Get metadata for member form (estados, congregaciones, tipos)
router.get('/meta', async (req, res) => {
    try {
        const [estados, congregaciones, tipos, ministerios] = await Promise.all([
            db_1.default.estado.findMany({
                where: { entidad: 'MIEMBRO' },
                orderBy: { nombre: 'asc' }
            }),
            db_1.default.congregacion.findMany({
                include: { estado: true },
                orderBy: { nombre: 'asc' }
            }),
            db_1.default.tipoMiembro.findMany({
                orderBy: { nombre: 'asc' }
            }),
            db_1.default.ministerio.findMany({
                include: { estado: true },
                orderBy: { nombre: 'asc' }
            })
        ]);
        res.json({ estados, congregaciones, tipos, ministerios });
    }
    catch (error) {
        console.error('Get metadata error:', error);
        res.status(500).json({ error: 'Error al obtener metadatos' });
    }
});
exports.default = router;
//# sourceMappingURL=miembros.js.map