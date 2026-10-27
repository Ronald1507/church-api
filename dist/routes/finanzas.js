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
// Una transacción solo afecta el saldo de la cuenta cuando está CONFIRMADA.
// El signo lo define la naturaleza del tipo (ingreso suma, egreso resta).
const esIngresoNaturaleza = (nat) => nat === 'ENTRADA' || nat === 'INGRESO';
// ============================================
// LISTADOS SEPARADOS (uno para cada cosa)
// ============================================
// Listado de estados de cuentas
router.get("/listado/estados-cuentas", auth_1.authenticateToken, (0, permissions_1.requirePermission)("finanzas", "leer"), async (req, res) => {
    try {
        const estados = await db_1.default.estado.findMany({
            where: { entidad: "FINANZA_CUENTA" },
            orderBy: { nombre: "asc" }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(estados));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener estados de cuentas', error));
    }
});
// Listado de estados de transacciones
router.get("/listado/estados-transacciones", auth_1.authenticateToken, (0, permissions_1.requirePermission)("finanzas", "leer"), async (req, res) => {
    try {
        const estados = await db_1.default.estado.findMany({
            where: { entidad: "TRANSACCION" },
            orderBy: { nombre: "asc" }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(estados));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener estados de transacciones', error));
    }
});
// Listado de congregaciones para finanzas
router.get("/listado/congregaciones", auth_1.authenticateToken, (0, permissions_1.requirePermission)("finanzas", "leer"), async (req, res) => {
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
// Listado de tipos de cuenta
router.get("/listado/tipos-cuenta", auth_1.authenticateToken, (0, permissions_1.requirePermission)("finanzas", "leer"), async (req, res) => {
    const tipos = [
        { id: 'CORRIENTE', nombre: 'Corriente' },
        { id: 'AHORRO', nombre: 'Ahorro' },
        { id: 'EFECTIVO', nombre: 'Efectivo' }
    ];
    return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(tipos));
});
// Listado de tipos de transacción (desde tabla normalizada)
router.get("/listado/tipos-transaccion", auth_1.authenticateToken, (0, permissions_1.requirePermission)("finanzas", "leer"), async (req, res) => {
    try {
        const tipos = await db_1.default.tipoTransaccion.findMany({
            orderBy: { nombre: "asc" }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(tipos));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener tipos de transacción', error));
    }
});
// Listado de métodos de pago (desde tabla normalizada)
router.get("/listado/metodos-pago", auth_1.authenticateToken, (0, permissions_1.requirePermission)("finanzas", "leer"), async (req, res) => {
    try {
        const metodos = await db_1.default.metodoPago.findMany({
            where: { activo: true },
            orderBy: { nombre: "asc" }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(metodos));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener métodos de pago', error));
    }
});
// Listado de instituciones para finanzas
router.get("/listado/instituciones", auth_1.authenticateToken, (0, permissions_1.requirePermission)("finanzas", "leer"), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const instituciones = await db_1.default.institucion.findMany({
            where: congregacionFilter,
            include: { estado: true },
            orderBy: { nombre: "asc" }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(instituciones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener instituciones', error));
    }
});
// ============================================
// CUENTAS
// ============================================
// GET all cuentas
router.get('/cuentas', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const cuentas = await db_1.default.finanzaCuenta.findMany({
            where: congregacionFilter,
            include: { congregacion: true, institucion: true, estado: true },
            orderBy: { nombre: 'asc' }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(cuentas));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener cuentas', error));
    }
});
// GET cuentas by estado
router.get('/cuentas/estado/:idEstado', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const idEstado = getNumericId(req.params.idEstado);
        if (idEstado === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID de estado inválido'));
        const estado = await db_1.default.estado.findUnique({ where: { id_estado: idEstado } });
        if (!estado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Estado no encontrado'));
        if (estado.entidad !== 'FINANZA_CUENTA')
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('El estado no pertenece a FINANZA_CUENTA'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const cuentas = await db_1.default.finanzaCuenta.findMany({
            where: { ...congregacionFilter, id_estado: idEstado },
            include: { congregacion: true, institucion: true, estado: true },
            orderBy: { nombre: 'asc' }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(cuentas));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener cuentas', error));
    }
});
// GET cuenta by ID
router.get('/cuentas/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const cuenta = await db_1.default.finanzaCuenta.findFirst({
            where: { id_cuenta: id, ...congregacionFilter },
            include: { congregacion: true, institucion: true, estado: true, transacciones: { orderBy: { fecha: 'desc' }, take: 50 } }
        });
        if (!cuenta)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Cuenta no encontrada'));
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(cuenta));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener cuenta', error));
    }
});
// POST create cuenta
router.post('/cuentas', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'crear'), async (req, res) => {
    try {
        const { nombre, tipo, descripcion, saldo_actual, id_congregacion, id_institucion, id_estado } = req.body;
        if (!nombre || !tipo || !id_estado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Faltan campos requeridos'));
        let congregacionId = id_congregacion;
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN' && req.user?.id_congregacion)
            congregacionId = req.user.id_congregacion;
        if (!congregacionId)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Debe especificar una congregación'));
        const newCuenta = await db_1.default.finanzaCuenta.create({
            data: {
                nombre,
                tipo,
                descripcion,
                saldo_actual: saldo_actual || 0,
                id_congregacion: congregacionId,
                id_institucion: id_institucion ? parseInt(id_institucion) : null,
                id_estado
            },
            include: { congregacion: true, institucion: true, estado: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(newCuenta, 'Cuenta creada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al crear cuenta', error));
    }
});
// PUT update cuenta
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
        if (updateData.id_institucion)
            updateData.id_institucion = parseInt(updateData.id_institucion);
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN') {
            delete updateData.id_congregacion;
            delete updateData.saldo_actual;
        }
        const updatedCuenta = await db_1.default.finanzaCuenta.update({
            where: { id_cuenta: id },
            data: updateData,
            include: { congregacion: true, institucion: true, estado: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(updatedCuenta, 'Cuenta actualizada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al actualizar cuenta', error));
    }
});
// GET cuentas by institución
router.get('/cuentas/institucion/:idInstitucion', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const idInstitucion = getNumericId(req.params.idInstitucion);
        if (idInstitucion === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID de institución inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const cuentas = await db_1.default.finanzaCuenta.findMany({
            where: { ...congregacionFilter, id_institucion: idInstitucion },
            include: { congregacion: true, institucion: true, estado: true },
            orderBy: { nombre: 'asc' }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(cuentas));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener cuentas', error));
    }
});
// DELETE cuenta (logical deletion)
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
        await db_1.default.finanzaCuenta.update({
            where: { id_cuenta: id },
            data: { id_estado: estadoInactiva.id_estado }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Cuenta eliminada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al eliminar cuenta', error));
    }
});
// PATCH toggle status cuenta
router.patch('/cuentas/:id/status', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existingCuenta = await db_1.default.finanzaCuenta.findFirst({ where: { id_cuenta: id, ...congregacionFilter } });
        if (!existingCuenta)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Cuenta no encontrada'));
        const estadoActivo = await (0, estados_1.getEstadoByCodigo)('FINANZA_CUENTA', 'ACTIVA');
        const estadoInactivo = await (0, estados_1.getEstadoByCodigo)('FINANZA_CUENTA', 'INACTIVA');
        if (!estadoActivo || !estadoInactivo)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estados no encontrados"));
        const nuevoEstado = existingCuenta.id_estado === estadoActivo.id_estado ? estadoInactivo.id_estado : estadoActivo.id_estado;
        await db_1.default.finanzaCuenta.update({
            where: { id_cuenta: id },
            data: { id_estado: nuevoEstado }
        });
        const mensaje = nuevoEstado === estadoActivo.id_estado ? 'Cuenta activada correctamente' : 'Cuenta inactivada correctamente';
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(null, mensaje));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al cambiar estado', error));
    }
});
// ============================================
// TRANSACCIONES
// ============================================
// GET all transacciones
router.get('/transacciones', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const transacciones = await db_1.default.transaccion.findMany({
            where: { cuenta: congregacionFilter },
            include: { cuenta: true, tipoTransaccion: true, metodoPago: true, estado: true, usuario: true },
            orderBy: { fecha: 'desc' }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(transacciones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener transacciones', error));
    }
});
// GET transacciones by cuenta
router.get('/cuentas/:id/transacciones', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const transacciones = await db_1.default.transaccion.findMany({
            where: { id_cuenta: id, cuenta: congregacionFilter },
            include: { cuenta: true, tipoTransaccion: true, metodoPago: true, estado: true, usuario: true },
            orderBy: { fecha: 'desc' }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(transacciones));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener transacciones', error));
    }
});
// POST create transaccion
router.post('/transacciones', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'crear'), async (req, res) => {
    try {
        const { id_cuenta, id_tipo, concepto, monto, fecha, id_metodo_pago, id_registrado_por, id_estado } = req.body;
        if (!id_cuenta || !id_tipo || !concepto || !monto || !id_estado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Faltan campos requeridos'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const cuenta = await db_1.default.finanzaCuenta.findFirst({ where: { id_cuenta: parseInt(id_cuenta), ...congregacionFilter } });
        if (!cuenta)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Cuenta no encontrada'));
        // Obtener naturaleza del tipo para calcular saldo
        const tipoTransaccion = await db_1.default.tipoTransaccion.findUnique({ where: { id_tipo: parseInt(id_tipo) } });
        if (!tipoTransaccion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Tipo de transacción no encontrado'));
        // Estado destino: el saldo solo se afecta si la transacción nace CONFIRMADA
        const estadoTx = await db_1.default.estado.findUnique({ where: { id_estado: parseInt(id_estado) } });
        if (!estadoTx || estadoTx.entidad !== 'TRANSACCION')
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Estado inválido para transacción'));
        const newTransaccion = await db_1.default.transaccion.create({
            data: {
                id_cuenta: parseInt(id_cuenta),
                id_tipo: parseInt(id_tipo),
                concepto,
                monto: parseFloat(monto),
                fecha: fecha ? new Date(fecha) : new Date(),
                id_metodo_pago: id_metodo_pago ? parseInt(id_metodo_pago) : null,
                id_registrado_por: id_registrado_por ? parseInt(id_registrado_por) : (req.user?.userId ?? 0),
                id_estado: parseInt(id_estado)
            },
            include: { cuenta: true, tipoTransaccion: true, metodoPago: true, estado: true, usuario: true }
        });
        // Actualizar saldo SOLO si la transacción está CONFIRMADA
        if (estadoTx.codigo === 'CONFIRMADA') {
            const delta = esIngresoNaturaleza(tipoTransaccion.naturaleza) ? parseFloat(monto) : -parseFloat(monto);
            await db_1.default.finanzaCuenta.update({
                where: { id_cuenta: parseInt(id_cuenta) },
                data: { saldo_actual: parseFloat(cuenta.saldo_actual.toString()) + delta },
            });
        }
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(newTransaccion, 'Transacción creada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al crear transacción', error));
    }
});
// PATCH cambiar estado de transacción (confirmar / volver a pendiente / cancelar)
// Ajusta el saldo de la cuenta según la transición:
//   no-confirmada -> CONFIRMADA  => aplica el monto al saldo
//   CONFIRMADA    -> no-confirmada => revierte el monto del saldo
router.patch('/transacciones/:id/estado', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const { id_estado } = req.body;
        if (!id_estado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Falta el estado'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const transaccion = await db_1.default.transaccion.findFirst({
            where: { id_transaccion: id, cuenta: congregacionFilter },
            include: { cuenta: true, tipoTransaccion: true, estado: true },
        });
        if (!transaccion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Transacción no encontrada'));
        const nuevoEstado = await db_1.default.estado.findUnique({ where: { id_estado: parseInt(String(id_estado)) } });
        if (!nuevoEstado || nuevoEstado.entidad !== 'TRANSACCION')
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Estado inválido para transacción'));
        const eraConfirmada = transaccion.estado?.codigo === 'CONFIRMADA';
        const seraConfirmada = nuevoEstado.codigo === 'CONFIRMADA';
        const delta = (esIngresoNaturaleza(transaccion.tipoTransaccion?.naturaleza) ? 1 : -1) * parseFloat(transaccion.monto.toString());
        const saldoActual = parseFloat(transaccion.cuenta.saldo_actual.toString());
        let ajuste = 0;
        if (!eraConfirmada && seraConfirmada)
            ajuste = delta; // se confirma -> aplica
        else if (eraConfirmada && !seraConfirmada)
            ajuste = -delta; // deja de estar confirmada -> revierte
        await db_1.default.$transaction(async (tx) => {
            await tx.transaccion.update({ where: { id_transaccion: id }, data: { id_estado: nuevoEstado.id_estado } });
            if (ajuste !== 0) {
                await tx.finanzaCuenta.update({ where: { id_cuenta: transaccion.id_cuenta }, data: { saldo_actual: saldoActual + ajuste } });
            }
        });
        const actualizada = await db_1.default.transaccion.findUnique({
            where: { id_transaccion: id },
            include: { cuenta: true, tipoTransaccion: true, metodoPago: true, estado: true, usuario: true },
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(actualizada, `Transacción ${nuevoEstado.nombre.toLowerCase()}`));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al cambiar estado de la transacción', error));
    }
});
// DELETE transaccion (cancelación lógica). Si estaba confirmada, revierte el saldo.
router.delete('/transacciones/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const transaccion = await db_1.default.transaccion.findFirst({
            where: { id_transaccion: id, cuenta: congregacionFilter },
            include: { cuenta: true, tipoTransaccion: true, estado: true },
        });
        if (!transaccion)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Transacción no encontrada'));
        const estadoCancelada = await (0, estados_1.getEstadoByCodigo)('TRANSACCION', 'CANCELADA');
        if (!estadoCancelada)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'CANCELADA' no encontrado"));
        const eraConfirmada = transaccion.estado?.codigo === 'CONFIRMADA';
        const delta = (esIngresoNaturaleza(transaccion.tipoTransaccion?.naturaleza) ? 1 : -1) * parseFloat(transaccion.monto.toString());
        const saldoActual = parseFloat(transaccion.cuenta.saldo_actual.toString());
        await db_1.default.$transaction(async (tx) => {
            await tx.transaccion.update({ where: { id_transaccion: id }, data: { id_estado: estadoCancelada.id_estado } });
            if (eraConfirmada) {
                // revertir el efecto que tenía en el saldo
                await tx.finanzaCuenta.update({ where: { id_cuenta: transaccion.id_cuenta }, data: { saldo_actual: saldoActual - delta } });
            }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Transacción cancelada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al eliminar transacción', error));
    }
});
// ============================================
// OFRENDAS Y DIEZMOS
// ============================================
// Una ofrenda/diezmo genera automáticamente una transacción de ingreso en la cuenta indicada.
// Listado de miembros para selects
router.get('/listado/miembros', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const miembros = await db_1.default.miembro.findMany({
            where: { ...congregacionFilter },
            select: { id_miembro: true, nombres: true, apellidos: true },
            orderBy: { apellidos: 'asc' }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(miembros));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener miembros', error));
    }
});
// GET todas las ofrendas (scope por congregación de la cuenta)
router.get('/ofrendas', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const ofrendas = await db_1.default.ofrendaDizmo.findMany({
            where: { transaccion: { cuenta: congregacionFilter } },
            take: 200,
            include: {
                miembro: { select: { id_miembro: true, nombres: true, apellidos: true } },
                transaccion: { include: { cuenta: true } }
            },
            orderBy: { fecha: 'desc' }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(ofrendas));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener ofrendas', error));
    }
});
// GET ofrendas de un miembro
router.get('/ofrendas/miembro/:idMiembro', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const idMiembro = getNumericId(req.params.idMiembro);
        if (idMiembro === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID de miembro inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const ofrendas = await db_1.default.ofrendaDizmo.findMany({
            where: { id_miembro: idMiembro, transaccion: { cuenta: congregacionFilter } },
            include: { transaccion: { include: { cuenta: true } } },
            orderBy: { fecha: 'desc' }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(ofrendas));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener ofrendas del miembro', error));
    }
});
// POST registrar ofrenda/diezmo (crea transacción de ingreso + actualiza saldo)
router.post('/ofrendas', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'crear'), async (req, res) => {
    try {
        const { id_miembro, id_cuenta, tipo, monto, fecha, sobre_numero, id_metodo_pago } = req.body;
        if (!id_miembro || !id_cuenta || !tipo || !monto)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Faltan campos requeridos'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const cuenta = await db_1.default.finanzaCuenta.findFirst({ where: { id_cuenta: parseInt(String(id_cuenta)), ...congregacionFilter } });
        if (!cuenta)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Cuenta no encontrada'));
        // Tipo de transacción de ingreso
        const tipoIngreso = await db_1.default.tipoTransaccion.findFirst({ where: { OR: [{ naturaleza: 'ENTRADA' }, { naturaleza: 'INGRESO' }, { nombre: 'INGRESO' }] } });
        // Estado de transacción
        const estadoConfirmada = await (0, estados_1.getEstadoByCodigo)('TRANSACCION', 'CONFIRMADA') || await (0, estados_1.getEstadoByCodigo)('TRANSACCION', 'PENDIENTE');
        if (!estadoConfirmada)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("No hay estados de TRANSACCION definidos. Ejecute el seed."));
        const montoNum = parseFloat(String(monto));
        const fechaOfrenda = fecha ? new Date(fecha) : new Date();
        const ofrenda = await db_1.default.$transaction(async (tx) => {
            const transaccion = await tx.transaccion.create({
                data: {
                    id_cuenta: parseInt(String(id_cuenta)),
                    id_tipo: tipoIngreso ? tipoIngreso.id_tipo : null,
                    concepto: `${tipo}${sobre_numero ? ' - sobre ' + sobre_numero : ''}`,
                    monto: montoNum,
                    fecha: fechaOfrenda,
                    id_metodo_pago: id_metodo_pago ? parseInt(String(id_metodo_pago)) : null,
                    id_registrado_por: req.user.userId,
                    id_estado: estadoConfirmada.id_estado,
                }
            });
            const nuevaOfrenda = await tx.ofrendaDizmo.create({
                data: {
                    id_miembro: parseInt(String(id_miembro)),
                    id_transaccion: transaccion.id_transaccion,
                    tipo,
                    fecha: fechaOfrenda,
                    monto: montoNum,
                    sobre_numero: sobre_numero || null,
                },
                include: {
                    miembro: { select: { id_miembro: true, nombres: true, apellidos: true } },
                    transaccion: { include: { cuenta: true } }
                }
            });
            const nuevoSaldo = parseFloat(cuenta.saldo_actual.toString()) + montoNum;
            await tx.finanzaCuenta.update({ where: { id_cuenta: parseInt(String(id_cuenta)) }, data: { saldo_actual: nuevoSaldo } });
            return nuevaOfrenda;
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(ofrenda, 'Ofrenda registrada correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al registrar ofrenda', error));
    }
});
// DELETE ofrenda (revierte la transacción y el saldo)
router.delete('/ofrendas/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const ofrenda = await db_1.default.ofrendaDizmo.findFirst({
            where: { id_ofrenda: id, transaccion: { cuenta: congregacionFilter } },
            include: { transaccion: { include: { cuenta: true } } }
        });
        if (!ofrenda)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Ofrenda no encontrada'));
        const estadoCancelada = await (0, estados_1.getEstadoByCodigo)('TRANSACCION', 'CANCELADA');
        const montoNum = parseFloat(ofrenda.monto.toString());
        await db_1.default.$transaction(async (tx) => {
            await tx.ofrendaDizmo.delete({ where: { id_ofrenda: id } });
            if (estadoCancelada) {
                await tx.transaccion.update({ where: { id_transaccion: ofrenda.id_transaccion }, data: { id_estado: estadoCancelada.id_estado } });
            }
            const saldoActual = parseFloat(ofrenda.transaccion.cuenta.saldo_actual.toString());
            await tx.finanzaCuenta.update({ where: { id_cuenta: ofrenda.transaccion.id_cuenta }, data: { saldo_actual: saldoActual - montoNum } });
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Ofrenda eliminada y saldo revertido'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al eliminar ofrenda', error));
    }
});
// ============================================
// PRESUPUESTOS
// ============================================
// GET presupuestos (filtros opcionales: anio, mes)
router.get('/presupuestos', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const where = { ...congregacionFilter };
        const anio = getNumericId(req.query.anio || '');
        const mes = getNumericId(req.query.mes || '');
        if (anio !== null)
            where.anio = anio;
        if (mes !== null)
            where.mes = mes;
        const presupuestos = await db_1.default.presupuesto.findMany({
            where,
            include: { congregacion: true },
            orderBy: [{ anio: 'desc' }, { mes: 'desc' }, { categoria: 'asc' }]
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(presupuestos));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener presupuestos', error));
    }
});
// POST crear presupuesto
router.post('/presupuestos', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'crear'), async (req, res) => {
    try {
        const { anio, mes, categoria, monto_asignado, monto_ejecutado } = req.body;
        if (!anio || !mes || !categoria)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Faltan campos requeridos'));
        const { nivel } = req.user || {};
        let congregacionId;
        if (nivel === 'ADMIN' || nivel === 'SUPERADMIN') {
            // Admin puede especificar; si no, usa la propia (si la tiene)
            congregacionId = req.body.id_congregacion ? parseInt(String(req.body.id_congregacion)) : (req.user?.id_congregacion ?? null);
        }
        else {
            // No-admin siempre su propia congregación
            congregacionId = req.user?.id_congregacion ?? null;
        }
        if (!congregacionId)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Debe especificar una congregación'));
        const presupuesto = await db_1.default.presupuesto.create({
            data: {
                id_congregacion: congregacionId,
                anio: parseInt(String(anio)),
                mes: parseInt(String(mes)),
                categoria,
                monto_asignado: monto_asignado ? parseFloat(String(monto_asignado)) : 0,
                monto_ejecutado: monto_ejecutado ? parseFloat(String(monto_ejecutado)) : 0,
            },
            include: { congregacion: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(presupuesto, 'Presupuesto creado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al crear presupuesto', error));
    }
});
// PUT actualizar presupuesto
router.put('/presupuestos/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.presupuesto.findFirst({ where: { id_presupuesto: id, ...congregacionFilter } });
        if (!existing)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Presupuesto no encontrado'));
        const input = req.body;
        const updateData = {};
        if (input.categoria !== undefined)
            updateData.categoria = input.categoria;
        if (input.monto_asignado !== undefined)
            updateData.monto_asignado = parseFloat(String(input.monto_asignado));
        if (input.monto_ejecutado !== undefined)
            updateData.monto_ejecutado = parseFloat(String(input.monto_ejecutado));
        const presupuesto = await db_1.default.presupuesto.update({
            where: { id_presupuesto: id },
            data: updateData,
            include: { congregacion: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(presupuesto, 'Presupuesto actualizado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al actualizar presupuesto', error));
    }
});
// DELETE presupuesto (eliminación física: no tiene estado)
router.delete('/presupuestos/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const existing = await db_1.default.presupuesto.findFirst({ where: { id_presupuesto: id, ...congregacionFilter } });
        if (!existing)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Presupuesto no encontrado'));
        await db_1.default.presupuesto.delete({ where: { id_presupuesto: id } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Presupuesto eliminado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al eliminar presupuesto', error));
    }
});
exports.default = router;
//# sourceMappingURL=finanzas.js.map