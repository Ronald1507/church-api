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
// Opciones
router.get('/opciones', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'leer'), async (req, res) => {
    try {
        let congregacionFilter = {};
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN' && req.user?.id_congregacion)
            congregacionFilter = { id_congregacion: req.user.id_congregacion };
        const [estados, congregaciones] = await Promise.all([
            db_1.default.estado.findMany({ where: { entidad: 'INSTITUCION' }, orderBy: { nombre: 'asc' } }),
            db_1.default.congregacion.findMany({ where: congregacionFilter, include: { estado: true }, orderBy: { nombre: 'asc' } })
        ]);
        const tiposInstitucion = [
            { id: 'CORO', nombre: 'Coro' }, { id: 'JOVENES', nombre: 'Jóvenes' }, { id: 'DORCAS', nombre: 'Dorcas' },
            { id: 'ESCUELA_DOMINICAL', nombre: 'Escuela Dominical' }, { id: 'GUARDERIA', nombre: 'Guardería' }, { id: 'OTRO', nombre: 'Otro' }
        ];
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success({ estados, congregaciones, tipos: tiposInstitucion }));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener metadatos', error));
    }
});
// Get all instituciones
router.get('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const instituciones = await db_1.default.institucion.findMany({ where: congregacionFilter, include: { congregacion: true, estado: true }, orderBy: { nombre: 'asc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(instituciones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener instituciones', error));
    }
});
router.get('/estado/:idEstado', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'leer'), async (req, res) => {
    try {
        const idEstado = getNumericId(req.params.idEstado);
        if (idEstado === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID de estado inválido'));
        const estado = await db_1.default.estado.findUnique({ where: { id_estado: idEstado } });
        if (!estado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Estado no encontrado'));
        if (estado.entidad !== 'INSTITUCION')
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('El estado no pertenece a INSTITUCION'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const instituciones = await db_1.default.institucion.findMany({ where: { ...congregacionFilter, id_estado: idEstado }, include: { congregacion: true, estado: true }, orderBy: { nombre: 'asc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(instituciones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener instituciones', error));
    }
});
router.get('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const institucion = await db_1.default.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter }, include: { congregacion: true, estado: true, miembroInstitucions: { include: { miembro: true, estado: true } } } });
        if (!institucion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Institución no encontrada'));
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(institucion));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener institución', error));
    }
});
router.post('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'crear'), async (req, res) => {
    try {
        const { nombre, tipo, descripcion, id_congregacion, id_estado } = req.body;
        if (!nombre || !id_estado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Faltan campos requeridos'));
        let congregacionId = id_congregacion;
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN' && req.user?.id_congregacion)
            congregacionId = req.user.id_congregacion;
        if (!congregacionId)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Debe especificar una congregación'));
        const newInstitucion = await db_1.default.institucion.create({ data: { nombre, tipo, descripcion, id_congregacion: congregacionId, id_estado }, include: { congregacion: true, estado: true } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(newInstitucion, 'Institución creada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al crear institución', error));
    }
});
router.put('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existingInstitucion = await db_1.default.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter } });
        if (!existingInstitucion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Institución no encontrada'));
        const updateData = { ...req.body };
        delete updateData.id_institucion;
        delete updateData.created_at;
        delete updateData.updated_at;
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN' && updateData.id_congregacion)
            delete updateData.id_congregacion;
        const updatedInstitucion = await db_1.default.institucion.update({ where: { id_institucion: id }, data: updateData, include: { congregacion: true, estado: true } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(updatedInstitucion, 'Institución actualizada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al actualizar institución', error));
    }
});
router.delete('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existingInstitucion = await db_1.default.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter } });
        if (!existingInstitucion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Institución no encontrada'));
        const estadoInactiva = await (0, estados_1.getEstadoByCodigo)('INSTITUCION', 'INACTIVA');
        if (!estadoInactiva)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'INACTIVA' no encontrado"));
        await db_1.default.institucion.update({ where: { id_institucion: id }, data: { id_estado: estadoInactiva.id_estado } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Institución eliminada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al eliminar institución', error));
    }
});
// Miembros de institución
router.get('/:id/miembros', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const institucion = await db_1.default.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter } });
        if (!institucion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Institución no encontrada'));
        const miembros = await db_1.default.miembroInstitucion.findMany({ where: { id_institucion: id }, include: { miembro: true, estado: true }, orderBy: { fecha_ingreso: 'desc' } });
        const cargos = await db_1.default.cargoInstitucion.findMany({ where: { id_institucion: id, fecha_fin: null }, include: { miembro: true, estado: true } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success({ miembros, cargos }));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener miembros', error));
    }
});
router.post('/:id/miembros', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const { id_miembro, rol } = req.body;
        if (!id_miembro)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID de miembro requerido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const institucion = await db_1.default.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter } });
        if (!institucion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Institución no encontrada'));
        const miembro = await db_1.default.miembro.findFirst({ where: { id_miembro, ...congregacionFilter } });
        if (!miembro)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Miembro no encontrado en esta congregación'));
        const estadoActivo = await (0, estados_1.getEstadoByCodigo)('MIEMBRO', 'ACTIVO');
        if (!estadoActivo)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'ACTIVO' no encontrado"));
        const newRelacion = await db_1.default.miembroInstitucion.create({ data: { id_miembro, id_institucion: id, rol: rol || 'MIEMBRO', id_estado: estadoActivo.id_estado, fecha_ingreso: new Date() }, include: { miembro: true, institucion: true } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(newRelacion, 'Miembro agregado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al agregar miembro', error));
    }
});
router.post('/:id/cargos', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const { id_miembro, rol, fecha_inicio } = req.body;
        if (!id_miembro || !rol)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID de miembro y rol requeridos'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const institucion = await db_1.default.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter } });
        if (!institucion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Institución no encontrada'));
        const miembroInstitucion = await db_1.default.miembroInstitucion.findFirst({ where: { id_miembro, id_institucion: id } });
        if (!miembroInstitucion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('El miembro no pertenece a esta institución'));
        const estadoActivo = await (0, estados_1.getEstadoByCodigo)('MIEMBRO', 'ACTIVO');
        if (!estadoActivo)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'ACTIVO' no encontrado"));
        await db_1.default.cargoInstitucion.updateMany({ where: { id_miembro, id_institucion: id, fecha_fin: null }, data: { fecha_fin: new Date() } });
        const newCargo = await db_1.default.cargoInstitucion.create({ data: { id_miembro, id_institucion: id, rol, fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : new Date(), id_estado: estadoActivo.id_estado }, include: { miembro: true, institucion: true } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(newCargo, 'Cargo asignado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al asignar cargo', error));
    }
});
router.delete('/:id/miembros/:idMiembro', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        const idMiembroParam = req.params.idMiembro;
        const idMiembro = typeof idMiembroParam === 'string' ? parseInt(idMiembroParam) : parseInt(Array.isArray(idMiembroParam) ? idMiembroParam[0] : '');
        if (id === null || isNaN(idMiembro))
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const institucion = await db_1.default.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter } });
        if (!institucion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Institución no encontrada'));
        await db_1.default.miembroInstitucion.deleteMany({ where: { id_miembro: idMiembro, id_institucion: id } });
        await db_1.default.cargoInstitucion.deleteMany({ where: { id_miembro: idMiembro, id_institucion: id } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Miembro removido correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al remover miembro', error));
    }
});
exports.default = router;
//# sourceMappingURL=instituciones.js.map