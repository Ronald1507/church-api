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
// Listado: Estados
router.get('/listado/estados', auth_1.authenticateToken, (0, permissions_1.requirePermission)('configuracion', 'leer'), async (req, res) => {
    try {
        const estados = await db_1.default.estado.findMany({ where: { entidad: 'CONGREGACION' }, orderBy: { nombre: 'asc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(estados));
    }
    catch (error) {
        console.error('Get estados error:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener estados', error));
    }
});
// Get all congregaciones
router.get('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('configuracion', 'leer'), async (req, res) => {
    const { nivel, id_congregacion } = req.user || {};
    if (nivel !== 'SUPERADMIN') {
        if (nivel === 'ADMIN' && id_congregacion) {
            const congregacion = await db_1.default.congregacion.findUnique({ where: { id_congregacion }, include: { estado: true } });
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(congregacion ? [congregacion] : []));
        }
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success([]));
    }
    try {
        const congregaciones = await db_1.default.congregacion.findMany({ include: { estado: true }, orderBy: { nombre: 'asc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(congregaciones));
    }
    catch (error) {
        console.error('Error getting congregaciones:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener congregaciones', error));
    }
});
// Get congregaciones by estado
router.get('/estado/:idEstado', auth_1.authenticateToken, (0, permissions_1.requirePermission)('configuracion', 'leer'), async (req, res) => {
    const { nivel, id_congregacion } = req.user || {};
    const idEstado = getNumericId(req.params.idEstado);
    if (idEstado === null) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID de estado inválido'));
    }
    const estado = await db_1.default.estado.findUnique({ where: { id_estado: idEstado } });
    if (!estado) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Estado no encontrado'));
    }
    if (estado.entidad !== 'CONGREGACION') {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError(`El estado ${idEstado} no pertenece a la entidad CONGREGACION`));
    }
    if (nivel !== 'SUPERADMIN') {
        if (nivel === 'ADMIN' && id_congregacion) {
            const congregacion = await db_1.default.congregacion.findUnique({ where: { id_congregacion, id_estado: idEstado }, include: { estado: true } });
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(congregacion ? [congregacion] : []));
        }
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success([]));
    }
    try {
        const congregaciones = await db_1.default.congregacion.findMany({ where: { id_estado: idEstado }, include: { estado: true }, orderBy: { nombre: 'asc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(congregaciones));
    }
    catch (error) {
        console.error('Error getting congregaciones by estado:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener congregaciones', error));
    }
});
// Get congregacion by ID
router.get('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('configuracion', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        }
        const { nivel, id_congregacion } = req.user || {};
        if (nivel !== 'SUPERADMIN' && (nivel !== 'ADMIN' || id_congregacion !== id)) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.forbidden('No tienes acceso a esta congregación'));
        }
        const congregacion = await db_1.default.congregacion.findUnique({
            where: { id_congregacion: id },
            include: { estado: true, miembros: true, institucions: true, eventos: true, finanzasCuentas: true, inventarioItems: true, presupuestos: true, comunicaciones: true }
        });
        if (!congregacion) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Congregación no encontrada'));
        }
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(congregacion));
    }
    catch (error) {
        console.error('Error getting congregacion:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener congregación', error));
    }
});
// Create congregacion
router.post('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('configuracion', 'admin'), async (req, res) => {
    try {
        const { nombre, direccion, ciudad, region, id_pastor, telefono, email, id_estado } = req.body;
        if (!nombre || !id_estado) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Faltan campos requeridos'));
        }
        const newCongregacion = await db_1.default.congregacion.create({
            data: { nombre, direccion, ciudad, region, id_pastor: id_pastor ? parseInt(id_pastor) : null, telefono, email, id_estado },
            include: { estado: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(newCongregacion, 'Congregación creada correctamente'));
    }
    catch (error) {
        console.error('Error creating congregacion:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al crear congregación', error));
    }
});
// Update congregacion
router.put('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('configuracion', 'admin'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        }
        const updateData = { ...req.body };
        delete updateData.id_congregacion;
        delete updateData.created_at;
        delete updateData.updated_at;
        const updatedCongregacion = await db_1.default.congregacion.update({ where: { id_congregacion: id }, data: updateData, include: { estado: true } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(updatedCongregacion, 'Congregación actualizada correctamente'));
    }
    catch (error) {
        console.error('Error updating congregacion:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al actualizar congregación', error));
    }
});
// Delete congregacion
router.delete('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('configuracion', 'admin'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        }
        const estadoInactiva = await (0, estados_1.getEstadoByCodigo)('CONGREGACION', 'INACTIVA');
        if (!estadoInactiva) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'INACTIVA' no encontrado"));
        }
        await db_1.default.congregacion.update({ where: { id_congregacion: id }, data: { id_estado: estadoInactiva.id_estado } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Congregación eliminada correctamente'));
    }
    catch (error) {
        console.error('Error deleting congregacion:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al eliminar congregación', error));
    }
});
exports.default = router;
//# sourceMappingURL=congregaciones.js.map