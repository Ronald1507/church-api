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
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
const getId = (req) => {
    const id = req.params.id;
    const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
    return isNaN(num) ? null : num;
};
const getNumericId = (param) => {
    const value = Array.isArray(param) ? param[0] : param;
    const num = parseInt(value);
    return isNaN(num) ? null : num;
};
// Get options
router.get('/opciones', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'leer'), async (req, res) => {
    try {
        let congregacionFilter = {};
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN' && req.user?.id_congregacion) {
            congregacionFilter = { id_congregacion: req.user.id_congregacion };
        }
        const [estados, congregaciones] = await Promise.all([
            db_1.default.estado.findMany({ where: { entidad: 'EVENTO' }, orderBy: { nombre: 'asc' } }),
            db_1.default.congregacion.findMany({ where: congregacionFilter, include: { estado: true }, orderBy: { nombre: 'asc' } })
        ]);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success({ estados, congregaciones }));
    }
    catch (error) {
        console.error('Get metadata error:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener metadatos', error));
    }
});
// Get all eventos
router.get('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const eventos = await db_1.default.evento.findMany({ where: congregacionFilter, include: { congregacion: true, estado: true }, orderBy: { fecha_inicio: 'desc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(eventos));
    }
    catch (error) {
        console.error('Error getting eventos:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener eventos', error));
    }
});
// Get eventos by estado
router.get('/estado/:idEstado', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'leer'), async (req, res) => {
    try {
        const idEstado = getNumericId(req.params.idEstado);
        if (idEstado === null) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID de estado inválido'));
        }
        const estado = await db_1.default.estado.findUnique({ where: { id_estado: idEstado } });
        if (!estado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Estado no encontrado'));
        if (estado.entidad !== 'EVENTO')
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError(`El estado ${idEstado} no pertenece a EVENTO`));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const eventos = await db_1.default.evento.findMany({ where: { ...congregacionFilter, id_estado: idEstado }, include: { congregacion: true, estado: true }, orderBy: { fecha_inicio: 'desc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(eventos));
    }
    catch (error) {
        console.error('Error getting eventos by estado:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener eventos', error));
    }
});
// Get evento by ID
router.get('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const evento = await db_1.default.evento.findFirst({ where: { id_evento: id, ...congregacionFilter }, include: { congregacion: true, estado: true, asistencia: { include: { miembro: true } } } });
        if (!evento)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Evento no encontrado'));
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(evento));
    }
    catch (error) {
        console.error('Error getting evento:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener evento', error));
    }
});
// Create evento
router.post('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'crear'), async (req, res) => {
    try {
        const { nombre, tipo, descripcion, fecha_inicio, fecha_fin, lugar, id_congregacion, capacidad_max, id_estado } = req.body;
        if (!nombre || !fecha_inicio || !id_estado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Faltan campos requeridos'));
        let congregacionId = id_congregacion;
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN' && req.user?.id_congregacion)
            congregacionId = req.user.id_congregacion;
        if (!congregacionId)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Debe especificar una congregación'));
        const newEvento = await db_1.default.evento.create({
            data: { nombre, tipo, descripcion, fecha_inicio: new Date(fecha_inicio), fecha_fin: fecha_fin ? new Date(fecha_fin) : null, lugar, id_congregacion: congregacionId, capacidad_max: capacidad_max ? parseInt(capacidad_max) : null, id_estado },
            include: { congregacion: true, estado: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(newEvento, 'Evento creado correctamente'));
    }
    catch (error) {
        console.error('Error creating evento:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al crear evento', error));
    }
});
// Update evento
router.put('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existingEvento = await db_1.default.evento.findFirst({ where: { id_evento: id, ...congregacionFilter } });
        if (!existingEvento)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Evento no encontrado'));
        const updateData = { ...req.body };
        delete updateData.id_evento;
        delete updateData.created_at;
        delete updateData.updated_at;
        if (updateData.fecha_inicio)
            updateData.fecha_inicio = new Date(updateData.fecha_inicio);
        if (updateData.fecha_fin)
            updateData.fecha_fin = new Date(updateData.fecha_fin);
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN' && updateData.id_congregacion)
            delete updateData.id_congregacion;
        const updatedEvento = await db_1.default.evento.update({ where: { id_evento: id }, data: updateData, include: { congregacion: true, estado: true } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(updatedEvento, 'Evento actualizado correctamente'));
    }
    catch (error) {
        console.error('Error updating evento:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al actualizar evento', error));
    }
});
// Delete evento
router.delete('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existingEvento = await db_1.default.evento.findFirst({ where: { id_evento: id, ...congregacionFilter } });
        if (!existingEvento)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Evento no encontrado'));
        const estadoCancelado = await (0, estados_1.getEstadoByCodigo)('EVENTO', 'CANCELADO');
        if (!estadoCancelado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'CANCELADO' no encontrado"));
        await db_1.default.evento.update({ where: { id_evento: id }, data: { id_estado: estadoCancelado.id_estado } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Evento eliminado correctamente'));
    }
    catch (error) {
        console.error('Error deleting evento:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al eliminar evento', error));
    }
});
exports.default = router;
//# sourceMappingURL=eventos.js.map