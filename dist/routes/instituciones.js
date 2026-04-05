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
const router = (0, express_1.Router)();
// Helper to get numeric ID from params
const getId = (req) => {
    const id = req.params.id;
    const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
    return isNaN(num) ? null : num;
};
// Helper to get numeric ID from any param
const getNumericId = (param) => {
    const value = Array.isArray(param) ? param[0] : param;
    const num = parseInt(value);
    return isNaN(num) ? null : num;
};
// Get options for institucion form - MUST BE BEFORE /:id
router.get('/opciones', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'leer'), async (req, res) => {
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
        // Tipos de institución hardcodeados
        const tiposInstitucion = [
            { id: 'CORO', nombre: 'Coro' },
            { id: 'JOVENES', nombre: 'Jóvenes' },
            { id: 'DORCAS', nombre: 'Dorcas' },
            { id: 'ESCUELA_DOMINICAL', nombre: 'Escuela Dominical' },
            { id: 'GUARDERIA', nombre: 'Guardería' },
            { id: 'OTRO', nombre: 'Otro' }
        ];
        res.json({ estados, congregaciones, tipos: tiposInstitucion });
    }
    catch (error) {
        console.error('Get metadata error:', error);
        res.status(500).json({ error: 'Error al obtener metadatos' });
    }
});
// Get all instituciones - filtrado por congregación
router.get('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const instituciones = await db_1.default.institucion.findMany({
            where: {
                ...congregacionFilter
            },
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
// Get instituciones by estado - valida que el estado pertenezca a INSTITUCION
router.get('/estado/:idEstado', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'leer'), async (req, res) => {
    try {
        const idEstado = getNumericId(req.params.idEstado);
        if (idEstado === null) {
            return res.status(400).json({ error: 'ID de estado inválido' });
        }
        // Validar que el estado pertenece a la entidad INSTITUCION
        const estado = await db_1.default.estado.findUnique({
            where: { id_estado: idEstado }
        });
        if (!estado) {
            return res.status(404).json({ error: 'Estado no encontrado' });
        }
        if (estado.entidad !== 'INSTITUCION') {
            return res.status(400).json({ error: `El estado ${idEstado} no pertenece a la entidad INSTITUCION` });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const instituciones = await db_1.default.institucion.findMany({
            where: {
                ...congregacionFilter,
                id_estado: idEstado
            },
            include: {
                congregacion: true,
                estado: true
            },
            orderBy: { nombre: 'asc' }
        });
        res.json(instituciones);
    }
    catch (error) {
        console.error('Error getting instituciones by estado:', error);
        res.status(500).json({ error: 'Error al obtener instituciones' });
    }
});
// Get institucion by ID - DEBE SER ÚLTIMO
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
// Delete institucion (eliminación lógica)
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
        // Eliminación lógica: buscar estado por código
        const estadoInactiva = await (0, estados_1.getEstadoByCodigo)('INSTITUCION', 'INACTIVA');
        if (!estadoInactiva) {
            return res.status(500).json({ error: "Estado 'INACTIVA' no encontrado en la base de datos" });
        }
        await db_1.default.institucion.update({
            where: { id_institucion: id },
            data: { id_estado: estadoInactiva.id_estado }
        });
        res.json({ message: 'Institución eliminada (inactiva)' });
    }
    catch (error) {
        console.error('Error deleting institucion:', error);
        res.status(500).json({ error: 'Error al eliminar institución' });
    }
});
// ==================== CARGOS DE INSTITUCIÓN ====================
// Get members of an institucion with their roles
router.get('/:id/miembros', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'leer'), async (req, res) => {
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
            }
        });
        if (!institucion) {
            return res.status(404).json({ error: 'Institución no encontrada' });
        }
        const miembros = await db_1.default.miembroInstitucion.findMany({
            where: { id_institucion: id },
            include: {
                miembro: true,
                estado: true
            },
            orderBy: { fecha_ingreso: 'desc' }
        });
        // También obtener los cargos activos
        const cargos = await db_1.default.cargoInstitucion.findMany({
            where: {
                id_institucion: id,
                fecha_fin: null
            },
            include: {
                miembro: true,
                estado: true
            }
        });
        res.json({ miembros, cargos });
    }
    catch (error) {
        console.error('Error getting miembros:', error);
        res.status(500).json({ error: 'Error al obtener miembros de la institución' });
    }
});
// Add member to institucion
router.post('/:id/miembros', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const { id_miembro, rol } = req.body;
        if (!id_miembro) {
            return res.status(400).json({ error: 'ID de miembro requerido' });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const institucion = await db_1.default.institucion.findFirst({
            where: {
                id_institucion: id,
                ...congregacionFilter
            }
        });
        if (!institucion) {
            return res.status(404).json({ error: 'Institución no encontrada' });
        }
        // Verificar que el miembro exista y pertenezca a la misma congregación
        const miembro = await db_1.default.miembro.findFirst({
            where: {
                id_miembro,
                ...congregacionFilter
            }
        });
        if (!miembro) {
            return res.status(404).json({ error: 'Miembro no encontrado en esta congregación' });
        }
        // Obtener estado activo para miembros de institución
        const estadoActivo = await (0, estados_1.getEstadoByCodigo)('MIEMBRO', 'ACTIVO');
        if (!estadoActivo) {
            return res.status(500).json({ error: "Estado 'ACTIVO' no encontrado en la base de datos" });
        }
        const newRelacion = await db_1.default.miembroInstitucion.create({
            data: {
                id_miembro,
                id_institucion: id,
                rol: rol || 'MIEMBRO',
                id_estado: estadoActivo.id_estado,
                fecha_ingreso: new Date()
            },
            include: {
                miembro: true,
                institucion: true
            }
        });
        res.status(201).json(newRelacion);
    }
    catch (error) {
        console.error('Error adding miembro:', error);
        res.status(500).json({ error: 'Error al agregar miembro a la institución' });
    }
});
// Assign cargo to member in institucion
router.post('/:id/cargos', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const { id_miembro, rol, fecha_inicio } = req.body;
        if (!id_miembro || !rol) {
            return res.status(400).json({ error: 'ID de miembro y rol requeridos' });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const institucion = await db_1.default.institucion.findFirst({
            where: {
                id_institucion: id,
                ...congregacionFilter
            }
        });
        if (!institucion) {
            return res.status(404).json({ error: 'Institución no encontrada' });
        }
        // Verificar que el miembro esté relacionado con la institución
        const miembroInstitucion = await db_1.default.miembroInstitucion.findFirst({
            where: {
                id_miembro,
                id_institucion: id
            }
        });
        if (!miembroInstitucion) {
            return res.status(400).json({ error: 'El miembro no pertenece a esta institución' });
        }
        // Obtener estado activo para cargos
        const estadoActivo = await (0, estados_1.getEstadoByCodigo)('MIEMBRO', 'ACTIVO');
        if (!estadoActivo) {
            return res.status(500).json({ error: "Estado 'ACTIVO' no encontrado en la base de datos" });
        }
        // Si el miembro ya tiene un cargo activo, cerrarlo
        await db_1.default.cargoInstitucion.updateMany({
            where: {
                id_miembro,
                id_institucion: id,
                fecha_fin: null
            },
            data: {
                fecha_fin: new Date()
            }
        });
        const newCargo = await db_1.default.cargoInstitucion.create({
            data: {
                id_miembro,
                id_institucion: id,
                rol,
                fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : new Date(),
                id_estado: estadoActivo.id_estado
            },
            include: {
                miembro: true,
                institucion: true
            }
        });
        res.status(201).json(newCargo);
    }
    catch (error) {
        console.error('Error assigning cargo:', error);
        res.status(500).json({ error: 'Error al asignar cargo en la institución' });
    }
});
// Remove member from institucion
router.delete('/:id/miembros/:idMiembro', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        const idMiembroParam = req.params.idMiembro;
        const idMiembro = typeof idMiembroParam === 'string' ? parseInt(idMiembroParam) : parseInt(Array.isArray(idMiembroParam) ? idMiembroParam[0] : '');
        if (id === null || isNaN(idMiembro)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const institucion = await db_1.default.institucion.findFirst({
            where: {
                id_institucion: id,
                ...congregacionFilter
            }
        });
        if (!institucion) {
            return res.status(404).json({ error: 'Institución no encontrada' });
        }
        // Eliminar relación
        await db_1.default.miembroInstitucion.deleteMany({
            where: {
                id_miembro: idMiembro,
                id_institucion: id
            }
        });
        // Eliminar cargos del miembro en esta institución
        await db_1.default.cargoInstitucion.deleteMany({
            where: {
                id_miembro: idMiembro,
                id_institucion: id
            }
        });
        res.json({ message: 'Miembro removido de la institución correctamente' });
    }
    catch (error) {
        console.error('Error removing miembro:', error);
        res.status(500).json({ error: 'Error al remover miembro de la institución' });
    }
});
exports.default = router;
//# sourceMappingURL=instituciones.js.map