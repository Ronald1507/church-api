import { Router, Request, Response } from 'express';
import prisma from '../config/db';
import { authenticateToken, AuthRequest, getCongregacionFilter } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { getEstadoByCodigo } from '../utils/estados';
import { ApiResponse, sendResponse } from '../utils/response';

const router = Router();

const getId = (req: Request): number | null => {
  const id = req.params.id;
  const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
  return isNaN(num) ? null : num;
};

const getNumericId = (param: string | string[]): number | null => {
  const value = Array.isArray(param) ? param[0] : param;
  const num = parseInt(value);
  return isNaN(num) ? null : num;
};

// Opciones
router.get('/opciones', authenticateToken, requirePermission('finanzas', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    let congregacionFilter = {};
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) congregacionFilter = { id_congregacion: req.user.id_congregacion };
    const [estados, congregaciones] = await Promise.all([
      prisma.estado.findMany({ where: { entidad: 'TRANSACCION' }, orderBy: { nombre: 'asc' } }),
      prisma.congregacion.findMany({ where: congregacionFilter, include: { estado: true }, orderBy: { nombre: 'asc' } })
    ]);
    return sendResponse(res, ApiResponse.success({ estados, congregaciones }));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener metadatos', error));
  }
});

// Cuentas
router.get('/cuentas', authenticateToken, requirePermission('finanzas', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    const cuentas = await prisma.finanzaCuenta.findMany({ where: congregacionFilter, include: { congregacion: true, estado: true }, orderBy: { nombre: 'asc' } });
    return sendResponse(res, ApiResponse.success(cuentas));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener cuentas', error));
  }
});

router.get('/cuentas/estado/:idEstado', authenticateToken, requirePermission('finanzas', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const idEstado = getNumericId(req.params.idEstado);
    if (idEstado === null) return sendResponse(res, ApiResponse.validationError('ID de estado inválido'));
    const estado = await prisma.estado.findUnique({ where: { id_estado: idEstado } });
    if (!estado) return sendResponse(res, ApiResponse.notFound('Estado no encontrado'));
    if (estado.entidad !== 'FINANZA_CUENTA') return sendResponse(res, ApiResponse.validationError(`El estado no pertenece a FINANZA_CUENTA`));
    const congregacionFilter = getCongregacionFilter(req.user);
    const cuentas = await prisma.finanzaCuenta.findMany({ where: { ...congregacionFilter, id_estado: idEstado }, include: { congregacion: true, estado: true }, orderBy: { nombre: 'asc' } });
    return sendResponse(res, ApiResponse.success(cuentas));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener cuentas', error));
  }
});

router.get('/cuentas/:id', authenticateToken, requirePermission('finanzas', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const cuenta = await prisma.finanzaCuenta.findFirst({ where: { id_cuenta: id, ...congregacionFilter }, include: { congregacion: true, estado: true, transacciones: { orderBy: { fecha: 'desc' }, take: 50 } } });
    if (!cuenta) return sendResponse(res, ApiResponse.notFound('Cuenta no encontrada'));
    return sendResponse(res, ApiResponse.success(cuenta));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener cuenta', error));
  }
});

router.post('/cuentas', authenticateToken, requirePermission('finanzas', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, tipo, descripcion, saldo_actual, id_congregacion, id_estado } = req.body;
    if (!nombre || !tipo || !id_estado) return sendResponse(res, ApiResponse.validationError('Faltan campos requeridos'));
    let congregacionId = id_congregacion;
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) congregacionId = req.user.id_congregacion;
    if (!congregacionId) return sendResponse(res, ApiResponse.validationError('Debe especificar una congregación'));
    const newCuenta = await prisma.finanzaCuenta.create({ data: { nombre, tipo, descripcion, saldo_actual: saldo_actual || 0, id_congregacion: congregacionId, id_estado }, include: { congregacion: true, estado: true } });
    return sendResponse(res, ApiResponse.created(newCuenta, 'Cuenta creada correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al crear cuenta', error));
  }
});

router.put('/cuentas/:id', authenticateToken, requirePermission('finanzas', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const existingCuenta = await prisma.finanzaCuenta.findFirst({ where: { id_cuenta: id, ...congregacionFilter } });
    if (!existingCuenta) return sendResponse(res, ApiResponse.notFound('Cuenta no encontrada'));
    const updateData = { ...req.body };
    delete updateData.id_cuenta;
    delete updateData.created_at;
    delete updateData.updated_at;
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN') { delete updateData.id_congregacion; delete updateData.saldo_actual; }
    const updatedCuenta = await prisma.finanzaCuenta.update({ where: { id_cuenta: id }, data: updateData, include: { congregacion: true, estado: true } });
    return sendResponse(res, ApiResponse.updated(updatedCuenta, 'Cuenta actualizada correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al actualizar cuenta', error));
  }
});

router.delete('/cuentas/:id', authenticateToken, requirePermission('finanzas', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const existingCuenta = await prisma.finanzaCuenta.findFirst({ where: { id_cuenta: id, ...congregacionFilter } });
    if (!existingCuenta) return sendResponse(res, ApiResponse.notFound('Cuenta no encontrada'));
    const estadoInactiva = await getEstadoByCodigo('FINANZA_CUENTA', 'INACTIVA');
    if (!estadoInactiva) return sendResponse(res, ApiResponse.error("Estado 'INACTIVA' no encontrado"));
    await prisma.finanzaCuenta.update({ where: { id_cuenta: id }, data: { id_estado: estadoInactiva.id_estado } });
    return sendResponse(res, ApiResponse.deleted('Cuenta eliminada correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al eliminar cuenta', error));
  }
});

// Transacciones
router.get('/transacciones', authenticateToken, requirePermission('finanzas', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    const transacciones = await prisma.transaccion.findMany({ where: { cuenta: congregacionFilter }, include: { cuenta: true, estado: true }, orderBy: { fecha: 'desc' } });
    return sendResponse(res, ApiResponse.success(transacciones));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener transacciones', error));
  }
});

router.get('/cuentas/:id/transacciones', authenticateToken, requirePermission('finanzas', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const transacciones = await prisma.transaccion.findMany({ where: { id_cuenta: id, cuenta: congregacionFilter }, include: { cuenta: true, estado: true }, orderBy: { fecha: 'desc' } });
    return sendResponse(res, ApiResponse.success(transacciones));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener transacciones', error));
  }
});

router.post('/transacciones', authenticateToken, requirePermission('finanzas', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { id_cuenta, tipo, concepto, monto, fecha, metodo_pago, id_registrado_por, id_estado } = req.body;
    if (!id_cuenta || !tipo || !concepto || !monto || !id_estado) return sendResponse(res, ApiResponse.validationError('Faltan campos requeridos'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const cuenta = await prisma.finanzaCuenta.findFirst({ where: { id_cuenta: parseInt(id_cuenta), ...congregacionFilter } });
    if (!cuenta) return sendResponse(res, ApiResponse.notFound('Cuenta no encontrada'));
    const newTransaccion = await prisma.transaccion.create({
      data: { id_cuenta: parseInt(id_cuenta), tipo, concepto, monto: parseFloat(monto), fecha: fecha ? new Date(fecha) : new Date(), metodo_pago, id_registrado_por: id_registrado_por ? parseInt(id_registrado_por) : (req.user?.userId ?? 0), id_estado },
      include: { cuenta: true, estado: true }
    });
    const nuevoSaldo = tipo === 'ingreso' ? parseFloat(cuenta.saldo_actual.toString()) + parseFloat(monto) : parseFloat(cuenta.saldo_actual.toString()) - parseFloat(monto);
    await prisma.finanzaCuenta.update({ where: { id_cuenta: parseInt(id_cuenta) }, data: { saldo_actual: nuevoSaldo } });
    return sendResponse(res, ApiResponse.created(newTransaccion, 'Transacción creada correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al crear transacción', error));
  }
});

router.delete('/transacciones/:id', authenticateToken, requirePermission('finanzas', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const transaccion = await prisma.transaccion.findFirst({ where: { id_transaccion: id, cuenta: congregacionFilter }, include: { cuenta: true } });
    if (!transaccion) return sendResponse(res, ApiResponse.notFound('Transacción no encontrada'));
    const estadoCancelada = await getEstadoByCodigo('TRANSACCION', 'CANCELADA');
    if (!estadoCancelada) return sendResponse(res, ApiResponse.error("Estado 'CANCELADA' no encontrado"));
    await prisma.transaccion.update({ where: { id_transaccion: id }, data: { id_estado: estadoCancelada.id_estado } });
    return sendResponse(res, ApiResponse.deleted('Transacción cancelada correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al eliminar transacción', error));
  }
});

export default router;