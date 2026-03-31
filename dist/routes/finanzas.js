"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
const router = (0, express_1.Router)();
// Helper to get numeric ID from params
const getId = (req) => {
    const id = req.params.id;
    const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
    return isNaN(num) ? null : num;
};
// ==================== CUENTAS ====================
// Get all cuentas - filtrado por congregación
router.get('/cuentas', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const cuentas = await db_1.default.finanzaCuenta.findMany({
            where: congregacionFilter,
            include: {
                congregacion: true,
                estado: true
            },
            orderBy: { nombre: 'asc' }
        });
        res.json(cuentas);
    }
    catch (error) {
        console.error('Error getting cuentas:', error);
        res.status(500).json({ error: 'Error al obtener cuentas' });
    }
});
// Get cuenta by ID - filtrado por congregación
router.get('/cuentas/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const cuenta = await db_1.default.finanzaCuenta.findFirst({
            where: {
                id_cuenta: id,
                ...congregacionFilter
            },
            include: {
                congregacion: true,
                estado: true,
                transacciones: {
                    orderBy: { fecha: 'desc' },
                    take: 50
                }
            }
        });
        if (!cuenta) {
            return res.status(404).json({ error: 'Cuenta no encontrada' });
        }
        res.json(cuenta);
    }
    catch (error) {
        console.error('Error getting cuenta:', error);
        res.status(500).json({ error: 'Error al obtener cuenta' });
    }
});
// Create cuenta
router.post('/cuentas', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'crear'), async (req, res) => {
    try {
        const { nombre, tipo, descripcion, saldo_actual, id_congregacion, id_estado } = req.body;
        if (!nombre || !tipo || !id_estado) {
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
        const newCuenta = await db_1.default.finanzaCuenta.create({
            data: {
                nombre,
                tipo,
                descripcion,
                saldo_actual: saldo_actual || 0,
                id_congregacion: congregacionId,
                id_estado
            },
            include: {
                congregacion: true,
                estado: true
            }
        });
        res.status(201).json(newCuenta);
    }
    catch (error) {
        console.error('Error creating cuenta:', error);
        res.status(500).json({ error: 'Error al crear cuenta' });
    }
});
// Update cuenta
router.put('/cuentas/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        // Verificar que la cuenta pertenezca a la congregación del usuario
        const existingCuenta = await db_1.default.finanzaCuenta.findFirst({
            where: {
                id_cuenta: id,
                ...congregacionFilter
            }
        });
        if (!existingCuenta) {
            return res.status(404).json({ error: 'Cuenta no encontrada' });
        }
        const updateData = { ...req.body };
        delete updateData.id_cuenta;
        delete updateData.created_at;
        delete updateData.updated_at;
        // Si no es admin, no permitir cambiar la congregación ni el saldo
        const { nivel } = req.user || {};
        if (nivel !== 'ADMIN') {
            delete updateData.id_congregacion;
            delete updateData.saldo_actual;
        }
        const updatedCuenta = await db_1.default.finanzaCuenta.update({
            where: { id_cuenta: id },
            data: updateData,
            include: {
                congregacion: true,
                estado: true
            }
        });
        res.json(updatedCuenta);
    }
    catch (error) {
        console.error('Error updating cuenta:', error);
        res.status(500).json({ error: 'Error al actualizar cuenta' });
    }
});
// Delete cuenta
router.delete('/cuentas/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        // Verificar que la cuenta pertenezca a la congregación del usuario
        const existingCuenta = await db_1.default.finanzaCuenta.findFirst({
            where: {
                id_cuenta: id,
                ...congregacionFilter
            }
        });
        if (!existingCuenta) {
            return res.status(404).json({ error: 'Cuenta no encontrada' });
        }
        await db_1.default.finanzaCuenta.delete({
            where: { id_cuenta: id }
        });
        res.json({ message: 'Cuenta eliminada correctamente' });
    }
    catch (error) {
        console.error('Error deleting cuenta:', error);
        res.status(500).json({ error: 'Error al eliminar cuenta' });
    }
});
// ==================== TRANSACCIONES ====================
// Get all transacciones - filtrado por congregación
router.get('/transacciones', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const transacciones = await db_1.default.transaccion.findMany({
            where: {
                cuenta: congregacionFilter
            },
            include: {
                cuenta: true,
                estado: true
            },
            orderBy: { fecha: 'desc' }
        });
        res.json(transacciones);
    }
    catch (error) {
        console.error('Error getting transacciones:', error);
        res.status(500).json({ error: 'Error al obtener transacciones' });
    }
});
// Get transacciones by cuenta - filtrado por congregación
router.get('/cuentas/:id/transacciones', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const transacciones = await db_1.default.transaccion.findMany({
            where: {
                id_cuenta: id,
                cuenta: congregacionFilter
            },
            include: {
                cuenta: true,
                estado: true
            },
            orderBy: { fecha: 'desc' }
        });
        res.json(transacciones);
    }
    catch (error) {
        console.error('Error getting transacciones:', error);
        res.status(500).json({ error: 'Error al obtener transacciones' });
    }
});
// Create transaccion
router.post('/transacciones', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'crear'), async (req, res) => {
    try {
        const { id_cuenta, tipo, concepto, monto, fecha, metodo_pago, id_registrado_por, id_estado } = req.body;
        if (!id_cuenta || !tipo || !concepto || !monto || !id_estado) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        // Verificar que la cuenta pertenezca a la congregación del usuario
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        const cuenta = await db_1.default.finanzaCuenta.findFirst({
            where: {
                id_cuenta: parseInt(id_cuenta),
                ...congregacionFilter
            }
        });
        if (!cuenta) {
            return res.status(404).json({ error: 'Cuenta no encontrada' });
        }
        const newTransaccion = await db_1.default.transaccion.create({
            data: {
                id_cuenta: parseInt(id_cuenta),
                tipo,
                concepto,
                monto: parseFloat(monto),
                fecha: fecha ? new Date(fecha) : new Date(),
                metodo_pago,
                id_registrado_por: id_registrado_por ? parseInt(id_registrado_por) : (req.user?.userId ?? 0),
                id_estado
            },
            include: {
                cuenta: true,
                estado: true
            }
        });
        // Update saldo de la cuenta
        const nuevoSaldo = tipo === 'ingreso'
            ? parseFloat(cuenta.saldo_actual.toString()) + parseFloat(monto)
            : parseFloat(cuenta.saldo_actual.toString()) - parseFloat(monto);
        await db_1.default.finanzaCuenta.update({
            where: { id_cuenta: parseInt(id_cuenta) },
            data: { saldo_actual: nuevoSaldo }
        });
        res.status(201).json(newTransaccion);
    }
    catch (error) {
        console.error('Error creating transaccion:', error);
        res.status(500).json({ error: 'Error al crear transacción' });
    }
});
// Delete transaccion
router.delete('/transacciones/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const congregacionFilter = (0, auth_1.getCongregacionFilter)(req.user);
        // Get transaccion first to verify access
        const transaccion = await db_1.default.transaccion.findFirst({
            where: {
                id_transaccion: id,
                cuenta: congregacionFilter
            },
            include: { cuenta: true }
        });
        if (!transaccion) {
            return res.status(404).json({ error: 'Transacción no encontrada' });
        }
        // Update saldo de la cuenta
        const cuenta = transaccion.cuenta;
        const nuevoSaldo = transaccion.tipo === 'ingreso'
            ? parseFloat(cuenta.saldo_actual.toString()) - parseFloat(transaccion.monto.toString())
            : parseFloat(cuenta.saldo_actual.toString()) + parseFloat(transaccion.monto.toString());
        await db_1.default.finanzaCuenta.update({
            where: { id_cuenta: cuenta.id_cuenta },
            data: { saldo_actual: nuevoSaldo }
        });
        await db_1.default.transaccion.delete({
            where: { id_transaccion: id }
        });
        res.json({ message: 'Transacción eliminada correctamente' });
    }
    catch (error) {
        console.error('Error deleting transaccion:', error);
        res.status(500).json({ error: 'Error al eliminar transacción' });
    }
});
// ==================== METADATA ====================
// Get metadata for finance forms
router.get('/meta', auth_1.authenticateToken, (0, permissions_1.requirePermission)('finanzas', 'leer'), async (req, res) => {
    try {
        let congregacionFilter = {};
        const { nivel } = req.user || {};
        // Si no es admin, solo puede ver su congregación
        if (nivel !== 'ADMIN' && req.user?.id_congregacion) {
            congregacionFilter = { id_congregacion: req.user.id_congregacion };
        }
        const [estados, congregaciones] = await Promise.all([
            db_1.default.estado.findMany({
                where: { entidad: 'TRANSACCION' },
                orderBy: { nombre: 'asc' }
            }),
            db_1.default.congregacion.findMany({
                where: congregacionFilter,
                include: { estado: true },
                orderBy: { nombre: 'asc' }
            })
        ]);
        res.json({ estados, congregaciones });
    }
    catch (error) {
        console.error('Get metadata error:', error);
        res.status(500).json({ error: 'Error al obtener metadatos' });
    }
});
exports.default = router;
//# sourceMappingURL=finanzas.js.map