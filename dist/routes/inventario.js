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
router.get('/listado/estados', auth_1.authenticateToken, (0, permissions_1.requirePermission)('inventario', 'leer'), async (req, res) => {
    try {
        const estados = await db_1.default.estado.findMany({ where: { entidad: 'INVENTARIO' }, orderBy: { nombre: 'asc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(estados));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener estados', error));
    }
});
// Listado: Congregaciones
router.get('/listado/congregaciones', auth_1.authenticateToken, (0, permissions_1.requirePermission)('inventario', 'leer'), async (req, res) => {
    try {
        let congregacionFilter = {};
        const { nivel } = req.user || {};
        if (nivel !== 'SUPERADMIN' && req.user?.id_congregacion)
            congregacionFilter = { id_congregacion: req.user.id_congregacion };
        const congregaciones = await db_1.default.congregacion.findMany({ where: congregacionFilter, include: { estado: true }, orderBy: { nombre: 'asc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(congregaciones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener congregaciones', error));
    }
});
// Items
router.get('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('inventario', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const items = await db_1.default.inventarioItem.findMany({ where: congregacionFilter, include: { congregacion: true, estado: true }, orderBy: { nombre: 'asc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(items));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener items', error));
    }
});
router.get('/estado/:idEstado', auth_1.authenticateToken, (0, permissions_1.requirePermission)('inventario', 'leer'), async (req, res) => {
    try {
        const idEstado = getNumericId(req.params.idEstado);
        if (idEstado === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID de estado inválido'));
        const estado = await db_1.default.estado.findUnique({ where: { id_estado: idEstado } });
        if (!estado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Estado no encontrado'));
        if (estado.entidad !== 'INVENTARIO')
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('El estado no pertenece a INVENTARIO'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const items = await db_1.default.inventarioItem.findMany({ where: { ...congregacionFilter, id_estado: idEstado }, include: { congregacion: true, estado: true }, orderBy: { nombre: 'asc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(items));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener items', error));
    }
});
router.get('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('inventario', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const item = await db_1.default.inventarioItem.findFirst({ where: { id_item: id, ...congregacionFilter }, include: { congregacion: true, estado: true, movimientos: { orderBy: { fecha: 'desc' }, take: 20 }, prestamos: { include: { institucion: true, estado: true } } } });
        if (!item)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Item no encontrado'));
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(item));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener item', error));
    }
});
router.post('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('inventario', 'crear'), async (req, res) => {
    try {
        const { nombre, categoria, descripcion, codigo, cantidad, unidad_medida, valor_unitario, ubicacion, id_congregacion, id_estado } = req.body;
        if (!nombre || !id_estado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Faltan campos requeridos'));
        let congregacionId = id_congregacion;
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN' && req.user?.id_congregacion)
            congregacionId = req.user.id_congregacion;
        if (!congregacionId)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Debe especificar una congregación'));
        const newItem = await db_1.default.inventarioItem.create({
            data: { nombre, categoria, descripcion, codigo, cantidad: cantidad || 1, unidad_medida: unidad_medida || 'unidad', valor_unitario: valor_unitario ? parseFloat(valor_unitario) : null, ubicacion, id_congregacion: congregacionId, id_estado },
            include: { congregacion: true, estado: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(newItem, 'Item creado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al crear item', error));
    }
});
router.put('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('inventario', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existingItem = await db_1.default.inventarioItem.findFirst({ where: { id_item: id, ...congregacionFilter } });
        if (!existingItem)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Item no encontrado'));
        const updateData = { ...req.body };
        delete updateData.id_item;
        delete updateData.created_at;
        delete updateData.updated_at;
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN' && updateData.id_congregacion)
            delete updateData.id_congregacion;
        const updatedItem = await db_1.default.inventarioItem.update({ where: { id_item: id }, data: updateData, include: { congregacion: true, estado: true } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(updatedItem, 'Item actualizado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al actualizar item', error));
    }
});
router.delete('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('inventario', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existingItem = await db_1.default.inventarioItem.findFirst({ where: { id_item: id, ...congregacionFilter } });
        if (!existingItem)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Item no encontrado'));
        const estadoBaja = await (0, estados_1.getEstadoByCodigo)('INVENTARIO', 'BAJA');
        if (!estadoBaja)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'BAJA' no encontrado"));
        await db_1.default.inventarioItem.update({ where: { id_item: id }, data: { id_estado: estadoBaja.id_estado } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Item dado de baja correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al eliminar item', error));
    }
});
// Movimientos
router.get('/movimientos', auth_1.authenticateToken, (0, permissions_1.requirePermission)('inventario', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const movimientos = await db_1.default.movimientoInventario.findMany({ where: { item: congregacionFilter }, include: { item: true }, orderBy: { fecha: 'desc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(movimientos));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener movimientos', error));
    }
});
router.post('/movimientos', auth_1.authenticateToken, (0, permissions_1.requirePermission)('inventario', 'crear'), async (req, res) => {
    try {
        const { id_item, tipo, cantidad, fecha, id_responsable, motivo } = req.body;
        if (!id_item || !tipo || !cantidad || !id_responsable)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Faltan campos requeridos'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const item = await db_1.default.inventarioItem.findFirst({ where: { id_item: parseInt(id_item), ...congregacionFilter } });
        if (!item)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Item no encontrado'));
        const nuevaCantidad = tipo === 'entrada' ? item.cantidad + cantidad : item.cantidad - cantidad;
        if (nuevaCantidad < 0)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('No hay suficiente stock'));
        const [newMovimiento] = await db_1.default.$transaction([
            db_1.default.movimientoInventario.create({ data: { id_item: parseInt(id_item), tipo, cantidad, fecha: fecha ? new Date(fecha) : new Date(), id_responsable: parseInt(id_responsable), motivo }, include: { item: true } }),
            db_1.default.inventarioItem.update({ where: { id_item: parseInt(id_item) }, data: { cantidad: nuevaCantidad } })
        ]);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(newMovimiento, 'Movimiento creado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al crear movimiento', error));
    }
});
exports.default = router;
//# sourceMappingURL=inventario.js.map