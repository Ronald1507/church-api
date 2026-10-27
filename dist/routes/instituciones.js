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
// Listado de estados de instituciones
router.get("/listado/estados", auth_1.authenticateToken, (0, permissions_1.requirePermission)("instituciones", "leer"), async (req, res) => {
    try {
        const estados = await db_1.default.estado.findMany({
            where: { entidad: "INSTITUCION" },
            orderBy: { nombre: "asc" }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(estados));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener estados', error));
    }
});
// Listado de congregaciones para instituciones
router.get("/listado/congregaciones", auth_1.authenticateToken, (0, permissions_1.requirePermission)("instituciones", "leer"), async (req, res) => {
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
// Listado de tipos de institución
router.get("/listado/tipos", auth_1.authenticateToken, (0, permissions_1.requirePermission)("instituciones", "leer"), async (req, res) => {
    const tiposInstitucion = [
        { id: 'CORO', nombre: 'Coro' },
        { id: 'JOVENES', nombre: 'Jóvenes' },
        { id: 'DORCAS', nombre: 'Dorcas' },
        { id: 'ESCUELA_DOMINICAL', nombre: 'Escuela Dominical' },
        { id: 'GUARDERIA', nombre: 'Guardería' },
        { id: 'OTRO', nombre: 'Otro' }
    ];
    return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(tiposInstitucion));
});
// ============================================
// CRUD
// ============================================
// GET all instituciones
router.get('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const instituciones = await db_1.default.institucion.findMany({
            where: congregacionFilter,
            include: {
                congregacion: true,
                estado: true,
                _count: { select: { miembroInstitucions: true } }
            },
            orderBy: { nombre: 'asc' }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(instituciones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener instituciones', error));
    }
});
// GET instituciones by estado
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
        const instituciones = await db_1.default.institucion.findMany({
            where: { ...congregacionFilter, id_estado: idEstado },
            include: { congregacion: true, estado: true, _count: { select: { miembroInstitucions: true } } },
            orderBy: { nombre: 'asc' }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(instituciones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener instituciones', error));
    }
});
// GET institucion by ID
router.get('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const institucion = await db_1.default.institucion.findFirst({
            where: { id_institucion: id, ...congregacionFilter },
            include: {
                congregacion: true,
                estado: true,
                miembroInstitucions: {
                    include: { miembro: true, estado: true },
                    orderBy: { fecha_ingreso: 'desc' }
                },
                cargoInstitucions: {
                    include: { miembro: true, estado: true },
                    where: { fecha_fin: null }
                }
            }
        });
        if (!institucion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Institución no encontrada'));
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(institucion));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener institución', error));
    }
});
// POST create institucion
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
        const newInstitucion = await db_1.default.institucion.create({
            data: { nombre, tipo, descripcion, id_congregacion: congregacionId, id_estado },
            include: { congregacion: true, estado: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(newInstitucion, 'Institución creada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al crear institución', error));
    }
});
// PUT update institucion
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
        const updatedInstitucion = await db_1.default.institucion.update({
            where: { id_institucion: id },
            data: updateData,
            include: { congregacion: true, estado: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(updatedInstitucion, 'Institución actualizada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al actualizar institución', error));
    }
});
// DELETE institucion (logical deletion)
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
        await db_1.default.institucion.update({
            where: { id_institucion: id },
            data: { id_estado: estadoInactiva.id_estado }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Institución eliminada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al eliminar institución', error));
    }
});
// PATCH toggle status
router.patch('/:id/status', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existingInstitucion = await db_1.default.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter } });
        if (!existingInstitucion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Institución no encontrada'));
        const estadoActivo = await (0, estados_1.getEstadoByCodigo)('INSTITUCION', 'ACTIVA');
        const estadoInactivo = await (0, estados_1.getEstadoByCodigo)('INSTITUCION', 'INACTIVA');
        if (!estadoActivo || !estadoInactivo)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estados no encontrados"));
        const nuevoEstado = existingInstitucion.id_estado === estadoActivo.id_estado ? estadoInactivo.id_estado : estadoActivo.id_estado;
        await db_1.default.institucion.update({
            where: { id_institucion: id },
            data: { id_estado: nuevoEstado }
        });
        const mensaje = nuevoEstado === estadoActivo.id_estado ? 'Institución activada correctamente' : 'Institución inactivada correctamente';
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(null, mensaje));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al cambiar estado', error));
    }
});
// ============================================
// CARGOS DE INSTITUCIÓN (directiva / liderazgo)
// ============================================
const getInstitucionAccesible = async (req, idInstitucion) => {
    const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
    return db_1.default.institucion.findFirst({ where: { id_institucion: idInstitucion, ...congregacionFilter } });
};
// GET cargos de una institución (por defecto solo vigentes; ?historial=true para todos)
router.get('/:id/cargos', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const institucion = await getInstitucionAccesible(req, id);
        if (!institucion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Institución no encontrada'));
        const incluirHistorial = String(req.query.historial) === 'true';
        const cargos = await db_1.default.cargoInstitucion.findMany({
            where: { id_institucion: id, ...(incluirHistorial ? {} : { fecha_fin: null }) },
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
            orderBy: { fecha_inicio: 'desc' }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(cargos));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener cargos', error));
    }
});
// POST crear cargo
router.post('/:id/cargos', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const institucion = await getInstitucionAccesible(req, id);
        if (!institucion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Institución no encontrada'));
        const { id_miembro, rol, fecha_inicio } = req.body;
        if (!id_miembro || !rol)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Faltan campos requeridos'));
        const estadoActivo = await (0, estados_1.getEstadoByCodigo)('CARGO_INSTITUCION', 'ACTIVO');
        if (!estadoActivo)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'ACTIVO' de CARGO_INSTITUCION no encontrado. Ejecute el seed."));
        const cargo = await db_1.default.cargoInstitucion.create({
            data: {
                id_miembro: parseInt(String(id_miembro)),
                id_institucion: id,
                rol,
                fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : new Date(),
                id_estado: estadoActivo.id_estado,
            },
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(cargo, 'Cargo asignado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al asignar cargo', error));
    }
});
// PUT actualizar cargo
router.put('/cargos/:idCargo', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'actualizar'), async (req, res) => {
    try {
        const idCargo = getNumericId(req.params.idCargo);
        if (idCargo === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.cargoInstitucion.findFirst({ where: { id_cargo: idCargo, institucion: { ...congregacionFilter } } });
        if (!existing)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Cargo no encontrado'));
        const input = req.body;
        const updateData = {};
        if (input.rol !== undefined)
            updateData.rol = input.rol;
        if (input.fecha_inicio !== undefined && input.fecha_inicio)
            updateData.fecha_inicio = new Date(input.fecha_inicio);
        if (input.fecha_fin !== undefined)
            updateData.fecha_fin = input.fecha_fin ? new Date(input.fecha_fin) : null;
        if (input.id_estado !== undefined && input.id_estado)
            updateData.id_estado = parseInt(String(input.id_estado));
        const cargo = await db_1.default.cargoInstitucion.update({
            where: { id_cargo: idCargo },
            data: updateData,
            include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(cargo, 'Cargo actualizado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al actualizar cargo', error));
    }
});
// DELETE finalizar cargo (cierra el período y marca FINALIZADO)
router.delete('/cargos/:idCargo', auth_1.authenticateToken, (0, permissions_1.requirePermission)('instituciones', 'eliminar'), async (req, res) => {
    try {
        const idCargo = getNumericId(req.params.idCargo);
        if (idCargo === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.cargoInstitucion.findFirst({ where: { id_cargo: idCargo, institucion: { ...congregacionFilter } } });
        if (!existing)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Cargo no encontrado'));
        const estadoFinalizado = await (0, estados_1.getEstadoByCodigo)('CARGO_INSTITUCION', 'FINALIZADO');
        if (!estadoFinalizado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'FINALIZADO' no encontrado"));
        await db_1.default.cargoInstitucion.update({
            where: { id_cargo: idCargo },
            data: { fecha_fin: new Date(), id_estado: estadoFinalizado.id_estado }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Cargo finalizado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al finalizar cargo', error));
    }
});
exports.default = router;
//# sourceMappingURL=instituciones.js.map