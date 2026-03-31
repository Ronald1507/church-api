"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const router = (0, express_1.Router)();
// Helper to get numeric ID from params
const getId = (req) => {
    const id = req.params.id;
    const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
    return isNaN(num) ? null : num;
};
// ==================== CUENTAS ====================
// Get all cuentas
router.get('/cuentas', async (req, res) => {
    try {
        const cuentas = await db_1.default.finanzaCuenta.findMany({
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
// Get cuenta by ID
router.get('/cuentas/:id', async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const cuenta = await db_1.default.finanzaCuenta.findUnique({
            where: { id_cuenta: id },
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
router.post('/cuentas', async (req, res) => {
    try {
        const { nombre, tipo, descripcion, saldo_actual, id_congregacion, id_estado } = req.body;
        if (!nombre || !tipo || !id_congregacion || !id_estado) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        const newCuenta = await db_1.default.finanzaCuenta.create({
            data: {
                nombre,
                tipo,
                descripcion,
                saldo_actual: saldo_actual || 0,
                id_congregacion,
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
router.put('/cuentas/:id', async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const updateData = { ...req.body };
        delete updateData.id_cuenta;
        delete updateData.created_at;
        delete updateData.updated_at;
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
router.delete('/cuentas/:id', async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
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
// Get all transacciones
router.get('/transacciones', async (req, res) => {
    try {
        const transacciones = await db_1.default.transaccion.findMany({
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
// Get transacciones by cuenta
router.get('/cuentas/:id/transacciones', async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const transacciones = await db_1.default.transaccion.findMany({
            where: { id_cuenta: id },
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
router.post('/transacciones', async (req, res) => {
    try {
        const { id_cuenta, tipo, concepto, monto, fecha, metodo_pago, id_registrado_por, id_estado } = req.body;
        if (!id_cuenta || !tipo || !concepto || !monto || !id_estado) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        const newTransaccion = await db_1.default.transaccion.create({
            data: {
                id_cuenta,
                tipo,
                concepto,
                monto: parseFloat(monto),
                fecha: fecha ? new Date(fecha) : new Date(),
                metodo_pago,
                id_registrado_por,
                id_estado
            },
            include: {
                cuenta: true,
                estado: true
            }
        });
        // Update saldo de la cuenta
        const cuenta = await db_1.default.finanzaCuenta.findUnique({ where: { id_cuenta } });
        if (cuenta) {
            const nuevoSaldo = tipo === 'ingreso'
                ? parseFloat(cuenta.saldo_actual.toString()) + parseFloat(monto)
                : parseFloat(cuenta.saldo_actual.toString()) - parseFloat(monto);
            await db_1.default.finanzaCuenta.update({
                where: { id_cuenta },
                data: { saldo_actual: nuevoSaldo }
            });
        }
        res.status(201).json(newTransaccion);
    }
    catch (error) {
        console.error('Error creating transaccion:', error);
        res.status(500).json({ error: 'Error al crear transacción' });
    }
});
// Delete transaccion
router.delete('/transacciones/:id', async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        // Get transaccion first to update saldo
        const transaccion = await db_1.default.transaccion.findUnique({
            where: { id_transaccion: id }
        });
        if (transaccion) {
            // Update saldo de la cuenta
            const cuenta = await db_1.default.finanzaCuenta.findUnique({
                where: { id_cuenta: transaccion.id_cuenta }
            });
            if (cuenta) {
                const nuevoSaldo = transaccion.tipo === 'ingreso'
                    ? parseFloat(cuenta.saldo_actual.toString()) - parseFloat(transaccion.monto.toString())
                    : parseFloat(cuenta.saldo_actual.toString()) + parseFloat(transaccion.monto.toString());
                await db_1.default.finanzaCuenta.update({
                    where: { id_cuenta: transaccion.id_cuenta },
                    data: { saldo_actual: nuevoSaldo }
                });
            }
        }
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
router.get('/meta', async (req, res) => {
    try {
        const [estados, congregaciones] = await Promise.all([
            db_1.default.estado.findMany({
                where: { entidad: 'TRANSACCION' },
                orderBy: { nombre: 'asc' }
            }),
            db_1.default.congregacion.findMany({
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