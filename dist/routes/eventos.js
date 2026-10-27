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
// ============================================
// LISTADOS SEPARADOS (uno para cada cosa)
// ============================================
// Listado de estados de eventos
router.get("/listado/estados", auth_1.authenticateToken, (0, permissions_1.requirePermission)("eventos", "leer"), async (req, res) => {
    try {
        const estados = await db_1.default.estado.findMany({
            where: { entidad: "EVENTO" },
            orderBy: { nombre: "asc" }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(estados));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener estados', error));
    }
});
// Listado de congregaciones para eventos
router.get("/listado/congregaciones", auth_1.authenticateToken, (0, permissions_1.requirePermission)("eventos", "leer"), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const congregaciones = await db_1.default.congregacion.findMany({
            where: congregacionFilter,
            include: { estado: true },
            orderBy: { nombre: "asc" }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(congregaciones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener congregaciones', error));
    }
});
// Listado de roles de servicio
router.get("/listado/roles-servicio", auth_1.authenticateToken, (0, permissions_1.requirePermission)("eventos", "leer"), async (req, res) => {
    try {
        const roles = await db_1.default.rolServicio.findMany({
            orderBy: { nombre: "asc" }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(roles));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener roles de servicio', error));
    }
});
// Listado de miembros para asistencia/servicios (scoped por congregación)
router.get("/listado/miembros", auth_1.authenticateToken, (0, permissions_1.requirePermission)("eventos", "leer"), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const miembros = await db_1.default.miembro.findMany({
            where: { ...congregacionFilter },
            select: { id_miembro: true, nombres: true, apellidos: true },
            orderBy: { apellidos: "asc" }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(miembros));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener miembros', error));
    }
});
// Listado de tipos de evento
router.get("/listado/tipos", auth_1.authenticateToken, (0, permissions_1.requirePermission)("eventos", "leer"), async (req, res) => {
    const tiposEvento = [
        { id: 'CULTO', nombre: 'Culto' },
        { id: 'ESCUELA', nombre: 'Escuela Dominical' },
        { id: 'JUVENIL', nombre: 'Juvenil' },
        { id: 'NIÑOS', nombre: 'Niños' },
        { id: 'OTRO', nombre: 'Otro' }
    ];
    return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(tiposEvento));
});
// ============================================
// CRUD
// ============================================
// GET all eventos
router.get('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const eventos = await db_1.default.evento.findMany({
            where: congregacionFilter,
            include: { congregacion: true, estado: true },
            orderBy: { fecha_inicio: 'desc' }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(eventos));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener eventos', error));
    }
});
// GET eventos by estado
router.get('/estado/:idEstado', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'leer'), async (req, res) => {
    try {
        const idEstado = getNumericId(req.params.idEstado);
        if (idEstado === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID de estado inválido'));
        const estado = await db_1.default.estado.findUnique({ where: { id_estado: idEstado } });
        if (!estado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Estado no encontrado'));
        if (estado.entidad !== 'EVENTO')
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('El estado no pertenece a EVENTO'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const eventos = await db_1.default.evento.findMany({
            where: { ...congregacionFilter, id_estado: idEstado },
            include: { congregacion: true, estado: true },
            orderBy: { fecha_inicio: 'desc' }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(eventos));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener eventos', error));
    }
});
// GET evento by ID
router.get('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const evento = await db_1.default.evento.findFirst({
            where: { id_evento: id, ...congregacionFilter },
            include: {
                congregacion: true,
                estado: true,
                asistencia: { include: { miembro: true } }
            }
        });
        if (!evento)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Evento no encontrado'));
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(evento));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener evento', error));
    }
});
// POST create evento
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
            include: { congregacion: true, estado: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(newEvento, 'Evento creado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al crear evento', error));
    }
});
// PUT update evento
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
        const updatedEvento = await db_1.default.evento.update({
            where: { id_evento: id },
            data: updateData,
            include: { congregacion: true, estado: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(updatedEvento, 'Evento actualizado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al actualizar evento', error));
    }
});
// DELETE evento (logical deletion)
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
        await db_1.default.evento.update({
            where: { id_evento: id },
            data: { id_estado: estadoCancelado.id_estado }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Evento eliminado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al eliminar evento', error));
    }
});
// PATCH toggle status
router.patch('/:id/status', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existingEvento = await db_1.default.evento.findFirst({ where: { id_evento: id, ...congregacionFilter } });
        if (!existingEvento)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Evento no encontrado'));
        const estadoActivo = await (0, estados_1.getEstadoByCodigo)('EVENTO', 'ACTIVO');
        const estadoInactivo = await (0, estados_1.getEstadoByCodigo)('EVENTO', 'INACTIVO');
        if (!estadoActivo || !estadoInactivo)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estados no encontrados"));
        const nuevoEstado = existingEvento.id_estado === estadoActivo.id_estado ? estadoInactivo.id_estado : estadoActivo.id_estado;
        await db_1.default.evento.update({
            where: { id_evento: id },
            data: { id_estado: nuevoEstado }
        });
        const mensaje = nuevoEstado === estadoActivo.id_estado ? 'Evento activado correctamente' : 'Evento inactivado correctamente';
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(null, mensaje));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al cambiar estado', error));
    }
});
// ============================================
// ASISTENCIA A EVENTOS
// ============================================
// Helper: verifica que el evento existe y es accesible por el usuario
const getEventoAccesible = async (req, idEvento) => {
    const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
    return db_1.default.evento.findFirst({ where: { id_evento: idEvento, ...congregacionFilter } });
};
// GET asistencia de un evento
router.get('/:id/asistencia', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const evento = await getEventoAccesible(req, id);
        if (!evento)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Evento no encontrado'));
        const asistencia = await db_1.default.asistenciaEvento.findMany({
            where: { id_evento: id },
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } } },
            orderBy: { hora_registro: 'desc' }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(asistencia));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener asistencia', error));
    }
});
// POST registrar asistencia
router.post('/:id/asistencia', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const evento = await getEventoAccesible(req, id);
        if (!evento)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Evento no encontrado'));
        const { id_miembro, tipo_registro } = req.body;
        if (!id_miembro)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Falta el miembro'));
        const existente = await db_1.default.asistenciaEvento.findFirst({ where: { id_evento: id, id_miembro: parseInt(String(id_miembro)) } });
        if (existente)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('El miembro ya está registrado en este evento'));
        const asistencia = await db_1.default.asistenciaEvento.create({
            data: { id_evento: id, id_miembro: parseInt(String(id_miembro)), tipo_registro: tipo_registro || 'presencial' },
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } } }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(asistencia, 'Asistencia registrada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al registrar asistencia', error));
    }
});
// DELETE quitar asistencia de un miembro
router.delete('/:id/asistencia/:idMiembro', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        const idMiembro = getNumericId(req.params.idMiembro);
        if (id === null || idMiembro === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const evento = await getEventoAccesible(req, id);
        if (!evento)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Evento no encontrado'));
        const existente = await db_1.default.asistenciaEvento.findFirst({ where: { id_evento: id, id_miembro: idMiembro } });
        if (!existente)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Registro de asistencia no encontrado'));
        await db_1.default.asistenciaEvento.delete({ where: { id: existente.id } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Asistencia eliminada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al eliminar asistencia', error));
    }
});
// ============================================
// SERVICIOS / EQUIPO DE TRABAJO DEL EVENTO
// ============================================
// GET servicios de un evento
router.get('/:id/servicios', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const evento = await getEventoAccesible(req, id);
        if (!evento)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Evento no encontrado'));
        const servicios = await db_1.default.servicio.findMany({
            where: { id_evento: id },
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, rol: true },
            orderBy: { fecha: 'desc' }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(servicios));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener servicios', error));
    }
});
// POST asignar un miembro a un rol de servicio en el evento
router.post('/:id/servicios', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const evento = await getEventoAccesible(req, id);
        if (!evento)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Evento no encontrado'));
        const { id_miembro, id_rol, observaciones } = req.body;
        if (!id_miembro || !id_rol)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Faltan campos requeridos'));
        const existente = await db_1.default.servicio.findFirst({ where: { id_evento: id, id_miembro: parseInt(String(id_miembro)), id_rol: parseInt(String(id_rol)) } });
        if (existente)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('El miembro ya tiene asignado ese rol en el evento'));
        const servicio = await db_1.default.servicio.create({
            data: { id_evento: id, id_miembro: parseInt(String(id_miembro)), id_rol: parseInt(String(id_rol)), observaciones: observaciones || null },
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, rol: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(servicio, 'Servicio asignado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al asignar servicio', error));
    }
});
// DELETE quitar un servicio
router.delete('/:id/servicios/:idServicio', auth_1.authenticateToken, (0, permissions_1.requirePermission)('eventos', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        const idServicio = getNumericId(req.params.idServicio);
        if (id === null || idServicio === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const evento = await getEventoAccesible(req, id);
        if (!evento)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Evento no encontrado'));
        const existente = await db_1.default.servicio.findFirst({ where: { id_servicio: idServicio, id_evento: id } });
        if (!existente)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Servicio no encontrado'));
        await db_1.default.servicio.delete({ where: { id_servicio: idServicio } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Servicio eliminado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al eliminar servicio', error));
    }
});
exports.default = router;
//# sourceMappingURL=eventos.js.map