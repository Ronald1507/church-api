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
router.get('/opciones', authenticateToken, requirePermission('inventario', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    let congregacionFilter = {};
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) congregacionFilter = { id_congregacion: req.user.id_congregacion };
    const [estados, congregaciones] = await Promise.all([
      prisma.estado.findMany({ where: { entidad: 'INVENTARIO' }, orderBy: { nombre: 'asc' } }),
      prisma.congregacion.findMany({ where: congregacionFilter, include: { estado: true }, orderBy: { nombre: 'asc' } })
    ]);
    return sendResponse(res, ApiResponse.success({ estados, congregaciones }));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener metadatos', error));
  }
});

// Items
router.get('/', authenticateToken, requirePermission('inventario', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    const items = await prisma.inventarioItem.findMany({ where: congregacionFilter, include: { congregacion: true, estado: true }, orderBy: { nombre: 'asc' } });
    return sendResponse(res, ApiResponse.success(items));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener items', error));
  }
});

router.get('/estado/:idEstado', authenticateToken, requirePermission('inventario', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const idEstado = getNumericId(req.params.idEstado);
    if (idEstado === null) return sendResponse(res, ApiResponse.validationError('ID de estado inválido'));
    const estado = await prisma.estado.findUnique({ where: { id_estado: idEstado } });
    if (!estado) return sendResponse(res, ApiResponse.notFound('Estado no encontrado'));
    if (estado.entidad !== 'INVENTARIO') return sendResponse(res, ApiResponse.validationError('El estado no pertenece a INVENTARIO'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const items = await prisma.inventarioItem.findMany({ where: { ...congregacionFilter, id_estado: idEstado }, include: { congregacion: true, estado: true }, orderBy: { nombre: 'asc' } });
    return sendResponse(res, ApiResponse.success(items));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener items', error));
  }
});

router.get('/:id', authenticateToken, requirePermission('inventario', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const item = await prisma.inventarioItem.findFirst({ where: { id_item: id, ...congregacionFilter }, include: { congregacion: true, estado: true, movimientos: { orderBy: { fecha: 'desc' }, take: 20 }, prestamos: { include: { institucion: true, estado: true } } } });
    if (!item) return sendResponse(res, ApiResponse.notFound('Item no encontrado'));
    return sendResponse(res, ApiResponse.success(item));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener item', error));
  }
});

router.post('/', authenticateToken, requirePermission('inventario', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, categoria, descripcion, codigo, cantidad, unidad_medida, valor_unitario, ubicacion, id_congregacion, id_estado } = req.body;
    if (!nombre || !id_estado) return sendResponse(res, ApiResponse.validationError('Faltan campos requeridos'));
    let congregacionId = id_congregacion;
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) congregacionId = req.user.id_congregacion;
    if (!congregacionId) return sendResponse(res, ApiResponse.validationError('Debe especificar una congregación'));
    const newItem = await prisma.inventarioItem.create({
      data: { nombre, categoria, descripcion, codigo, cantidad: cantidad || 1, unidad_medida: unidad_medida || 'unidad', valor_unitario: valor_unitario ? parseFloat(valor_unitario) : null, ubicacion, id_congregacion: congregacionId, id_estado },
      include: { congregacion: true, estado: true }
    });
    return sendResponse(res, ApiResponse.created(newItem, 'Item creado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al crear item', error));
  }
});

router.put('/:id', authenticateToken, requirePermission('inventario', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const existingItem = await prisma.inventarioItem.findFirst({ where: { id_item: id, ...congregacionFilter } });
    if (!existingItem) return sendResponse(res, ApiResponse.notFound('Item no encontrado'));
    const updateData = { ...req.body };
    delete updateData.id_item;
    delete updateData.created_at;
    delete updateData.updated_at;
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && updateData.id_congregacion) delete updateData.id_congregacion;
    const updatedItem = await prisma.inventarioItem.update({ where: { id_item: id }, data: updateData, include: { congregacion: true, estado: true } });
    return sendResponse(res, ApiResponse.updated(updatedItem, 'Item actualizado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al actualizar item', error));
  }
});

router.delete('/:id', authenticateToken, requirePermission('inventario', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const existingItem = await prisma.inventarioItem.findFirst({ where: { id_item: id, ...congregacionFilter } });
    if (!existingItem) return sendResponse(res, ApiResponse.notFound('Item no encontrado'));
    const estadoBaja = await getEstadoByCodigo('INVENTARIO', 'BAJA');
    if (!estadoBaja) return sendResponse(res, ApiResponse.error("Estado 'BAJA' no encontrado"));
    await prisma.inventarioItem.update({ where: { id_item: id }, data: { id_estado: estadoBaja.id_estado } });
    return sendResponse(res, ApiResponse.deleted('Item dado de baja correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al eliminar item', error));
  }
});

// Movimientos
router.get('/movimientos', authenticateToken, requirePermission('inventario', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    const movimientos = await prisma.movimientoInventario.findMany({ where: { item: congregacionFilter }, include: { item: true }, orderBy: { fecha: 'desc' } });
    return sendResponse(res, ApiResponse.success(movimientos));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener movimientos', error));
  }
});

router.post('/movimientos', authenticateToken, requirePermission('inventario', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { id_item, tipo, cantidad, fecha, id_responsable, motivo } = req.body;
    if (!id_item || !tipo || !cantidad || !id_responsable) return sendResponse(res, ApiResponse.validationError('Faltan campos requeridos'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const item = await prisma.inventarioItem.findFirst({ where: { id_item: parseInt(id_item), ...congregacionFilter } });
    if (!item) return sendResponse(res, ApiResponse.notFound('Item no encontrado'));
    const nuevaCantidad = tipo === 'entrada' ? item.cantidad + cantidad : item.cantidad - cantidad;
    if (nuevaCantidad < 0) return sendResponse(res, ApiResponse.validationError('No hay suficiente stock'));
    const [newMovimiento] = await prisma.$transaction([
      prisma.movimientoInventario.create({ data: { id_item: parseInt(id_item), tipo, cantidad, fecha: fecha ? new Date(fecha) : new Date(), id_responsable: parseInt(id_responsable), motivo }, include: { item: true } }),
      prisma.inventarioItem.update({ where: { id_item: parseInt(id_item) }, data: { cantidad: nuevaCantidad } })
    ]);
    return sendResponse(res, ApiResponse.created(newMovimiento, 'Movimiento creado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al crear movimiento', error));
  }
});

export default router;