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
router.get('/opciones', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        let congregacionFilter = {};
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN' && req.user?.id_congregacion)
            congregacionFilter = { id_congregacion: req.user.id_congregacion };
        const [estados, congregaciones] = await Promise.all([
            db_1.default.estado.findMany({ where: { entidad: 'TRANSACCION' }, orderBy: { nombre: 'asc' } }),
            db_1.default.congregacion.findMany({ where: congregacionFilter, include: { estado: true }, orderBy: { nombre: 'asc' } })
        ]);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success({ estados, congregaciones }));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener metadatos', error));
    }
});
// Cuentas
router.get('/cuentas', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const cuentas = await db_1.default.finanzaCuenta.findMany({ where: congregacionFilter, include: { congregacion: true, estado: true }, orderBy: { nombre: 'asc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(cuentas));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener cuentas', error));
    }
});
router.get('/cuentas/estado/:idEstado', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const idEstado = getNumericId(req.params.idEstado);
        if (idEstado === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID de estado inválido'));
        const estado = await db_1.default.estado.findUnique({ where: { id_estado: idEstado } });
        if (!estado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Estado no encontrado'));
        if (estado.entidad !== 'FINANZA_CUENTA')
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError(`El estado no pertenece a FINANZA_CUENTA`));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const cuentas = await db_1.default.finanzaCuenta.findMany({ where: { ...congregacionFilter, id_estado: idEstado }, include: { congregacion: true, estado: true }, orderBy: { nombre: 'asc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(cuentas));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener cuentas', error));
    }
});
router.get('/cuentas/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const cuenta = await db_1.default.finanzaCuenta.findFirst({ where: { id_cuenta: id, ...congregacionFilter }, include: { congregacion: true, estado: true, transacciones: { orderBy: { fecha: 'desc' }, take: 50 } } });
        if (!cuenta)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Cuenta no encontrada'));
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(cuenta));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener cuenta', error));
    }
});
router.post('/cuentas', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'crear'), async (req, res) => {
    try {
        const { nombre, tipo, descripcion, saldo_actual, id_congregacion, id_estado } = req.body;
        if (!nombre || !tipo || !id_estado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Faltan campos requeridos'));
        let congregacionId = id_congregacion;
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN' && req.user?.id_congregacion)
            congregacionId = req.user.id_congregacion;
        if (!congregacionId)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Debe especificar una congregación'));
        const newCuenta = await db_1.default.finanzaCuenta.create({ data: { nombre, tipo, descripcion, saldo_actual: saldo_actual || 0, id_congregacion: congregacionId, id_estado }, include: { congregacion: true, estado: true } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(newCuenta, 'Cuenta creada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al crear cuenta', error));
    }
});
router.put('/cuentas/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existingCuenta = await db_1.default.finanzaCuenta.findFirst({ where: { id_cuenta: id, ...congregacionFilter } });
        if (!existingCuenta)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Cuenta no encontrada'));
        const updateData = { ...req.body };
        delete updateData.id_cuenta;
        delete updateData.created_at;
        delete updateData.updated_at;
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN') {
            delete updateData.id_congregacion;
            delete updateData.saldo_actual;
        }
        const updatedCuenta = await db_1.default.finanzaCuenta.update({ where: { id_cuenta: id }, data: updateData, include: { congregacion: true, estado: true } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(updatedCuenta, 'Cuenta actualizada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al actualizar cuenta', error));
    }
});
router.delete('/cuentas/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existingCuenta = await db_1.default.finanzaCuenta.findFirst({ where: { id_cuenta: id, ...congregacionFilter } });
        if (!existingCuenta)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Cuenta no encontrada'));
        const estadoInactiva = await (0, estados_1.getEstadoByCodigo)('FINANZA_CUENTA', 'INACTIVA');
        if (!estadoInactiva)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'INACTIVA' no encontrado"));
        await db_1.default.finanzaCuenta.update({ where: { id_cuenta: id }, data: { id_estado: estadoInactiva.id_estado } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Cuenta eliminada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al eliminar cuenta', error));
    }
});
// Transacciones
router.get('/transacciones', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const transacciones = await db_1.default.transaccion.findMany({ where: { cuenta: congregacionFilter }, include: { cuenta: true, estado: true }, orderBy: { fecha: 'desc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(transacciones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener transacciones', error));
    }
});
router.get('/cuentas/:id/transacciones', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const transacciones = await db_1.default.transaccion.findMany({ where: { id_cuenta: id, cuenta: congregacionFilter }, include: { cuenta: true, estado: true }, orderBy: { fecha: 'desc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(transacciones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener transacciones', error));
    }
});
router.post('/transacciones', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'crear'), async (req, res) => {
    try {
        const { id_cuenta, tipo, concepto, monto, fecha, metodo_pago, id_registrado_por, id_estado } = req.body;
        if (!id_cuenta || !tipo || !concepto || !monto || !id_estado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Faltan campos requeridos'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const cuenta = await db_1.default.finanzaCuenta.findFirst({ where: { id_cuenta: parseInt(id_cuenta), ...congregacionFilter } });
        if (!cuenta)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Cuenta no encontrada'));
        const newTransaccion = await db_1.default.transaccion.create({
            data: { id_cuenta: parseInt(id_cuenta), tipo, concepto, monto: parseFloat(monto), fecha: fecha ? new Date(fecha) : new Date(), metodo_pago, id_registrado_por: id_registrado_por ? parseInt(id_registrado_por) : (req.user?.userId ?? 0), id_estado },
            include: { cuenta: true, estado: true }
        });
        const nuevoSaldo = tipo === 'ingreso' ? parseFloat(cuenta.saldo_actual.toString()) + parseFloat(monto) : parseFloat(cuenta.saldo_actual.toString()) - parseFloat(monto);
        await db_1.default.finanzaCuenta.update({ where: { id_cuenta: parseInt(id_cuenta) }, data: { saldo_actual: nuevoSaldo } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(newTransaccion, 'Transacción creada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al crear transacción', error));
    }
});
router.delete('/transacciones/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const transaccion = await db_1.default.transaccion.findFirst({ where: { id_transaccion: id, cuenta: congregacionFilter }, include: { cuenta: true } });
        if (!transaccion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Transacción no encontrada'));
        const estadoCancelada = await (0, estados_1.getEstadoByCodigo)('TRANSACCION', 'CANCELADA');
        if (!estadoCancelada)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'CANCELADA' no encontrado"));
        await db_1.default.transaccion.update({ where: { id_transaccion: id }, data: { id_estado: estadoCancelada.id_estado } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Transacción cancelada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al eliminar transacción', error));
    }
});
exports.default = router;
//# sourceMappingURL=finanzas.js.map