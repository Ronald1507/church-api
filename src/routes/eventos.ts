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

// Get options
router.get('/opciones', authenticateToken, requirePermission('eventos', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    let congregacionFilter = {};
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) {
      congregacionFilter = { id_congregacion: req.user.id_congregacion };
    }
    const [estados, congregaciones] = await Promise.all([
      prisma.estado.findMany({ where: { entidad: 'EVENTO' }, orderBy: { nombre: 'asc' } }),
      prisma.congregacion.findMany({ where: congregacionFilter, include: { estado: true }, orderBy: { nombre: 'asc' } })
    ]);
    return sendResponse(res, ApiResponse.success({ estados, congregaciones }));
  } catch (error) {
    console.error('Get metadata error:', error);
    return sendResponse(res, ApiResponse.error('Error al obtener metadatos', error));
  }
});

// Get all eventos
router.get('/', authenticateToken, requirePermission('eventos', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    const eventos = await prisma.evento.findMany({ where: congregacionFilter, include: { congregacion: true, estado: true }, orderBy: { fecha_inicio: 'desc' } });
    return sendResponse(res, ApiResponse.success(eventos));
  } catch (error) {
    console.error('Error getting eventos:', error);
    return sendResponse(res, ApiResponse.error('Error al obtener eventos', error));
  }
});

// Get eventos by estado
router.get('/estado/:idEstado', authenticateToken, requirePermission('eventos', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const idEstado = getNumericId(req.params.idEstado);
    if (idEstado === null) {
      return sendResponse(res, ApiResponse.validationError('ID de estado inválido'));
    }
    const estado = await prisma.estado.findUnique({ where: { id_estado: idEstado } });
    if (!estado) return sendResponse(res, ApiResponse.notFound('Estado no encontrado'));
    if (estado.entidad !== 'EVENTO') return sendResponse(res, ApiResponse.validationError(`El estado ${idEstado} no pertenece a EVENTO`));
    const congregacionFilter = getCongregacionFilter(req.user);
    const eventos = await prisma.evento.findMany({ where: { ...congregacionFilter, id_estado: idEstado }, include: { congregacion: true, estado: true }, orderBy: { fecha_inicio: 'desc' } });
    return sendResponse(res, ApiResponse.success(eventos));
  } catch (error) {
    console.error('Error getting eventos by estado:', error);
    return sendResponse(res, ApiResponse.error('Error al obtener eventos', error));
  }
});

// Get evento by ID
router.get('/:id', authenticateToken, requirePermission('eventos', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const evento = await prisma.evento.findFirst({ where: { id_evento: id, ...congregacionFilter }, include: { congregacion: true, estado: true, asistencia: { include: { miembro: true } } } });
    if (!evento) return sendResponse(res, ApiResponse.notFound('Evento no encontrado'));
    return sendResponse(res, ApiResponse.success(evento));
  } catch (error) {
    console.error('Error getting evento:', error);
    return sendResponse(res, ApiResponse.error('Error al obtener evento', error));
  }
});

// Create evento
router.post('/', authenticateToken, requirePermission('eventos', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, tipo, descripcion, fecha_inicio, fecha_fin, lugar, id_congregacion, capacidad_max, id_estado } = req.body;
    if (!nombre || !fecha_inicio || !id_estado) return sendResponse(res, ApiResponse.validationError('Faltan campos requeridos'));
    let congregacionId = id_congregacion;
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) congregacionId = req.user.id_congregacion;
    if (!congregacionId) return sendResponse(res, ApiResponse.validationError('Debe especificar una congregación'));
    const newEvento = await prisma.evento.create({
      data: { nombre, tipo, descripcion, fecha_inicio: new Date(fecha_inicio), fecha_fin: fecha_fin ? new Date(fecha_fin) : null, lugar, id_congregacion: congregacionId, capacidad_max: capacidad_max ? parseInt(capacidad_max) : null, id_estado },
      include: { congregacion: true, estado: true }
    });
    return sendResponse(res, ApiResponse.created(newEvento, 'Evento creado correctamente'));
  } catch (error) {
    console.error('Error creating evento:', error);
    return sendResponse(res, ApiResponse.error('Error al crear evento', error));
  }
});

// Update evento
router.put('/:id', authenticateToken, requirePermission('eventos', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const existingEvento = await prisma.evento.findFirst({ where: { id_evento: id, ...congregacionFilter } });
    if (!existingEvento) return sendResponse(res, ApiResponse.notFound('Evento no encontrado'));
    const updateData = { ...req.body };
    delete updateData.id_evento;
    delete updateData.created_at;
    delete updateData.updated_at;
    if (updateData.fecha_inicio) updateData.fecha_inicio = new Date(updateData.fecha_inicio);
    if (updateData.fecha_fin) updateData.fecha_fin = new Date(updateData.fecha_fin);
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && updateData.id_congregacion) delete updateData.id_congregacion;
    const updatedEvento = await prisma.evento.update({ where: { id_evento: id }, data: updateData, include: { congregacion: true, estado: true } });
    return sendResponse(res, ApiResponse.updated(updatedEvento, 'Evento actualizado correctamente'));
  } catch (error) {
    console.error('Error updating evento:', error);
    return sendResponse(res, ApiResponse.error('Error al actualizar evento', error));
  }
});

// Delete evento
router.delete('/:id', authenticateToken, requirePermission('eventos', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const existingEvento = await prisma.evento.findFirst({ where: { id_evento: id, ...congregacionFilter } });
    if (!existingEvento) return sendResponse(res, ApiResponse.notFound('Evento no encontrado'));
    const estadoCancelado = await getEstadoByCodigo('EVENTO', 'CANCELADO');
    if (!estadoCancelado) return sendResponse(res, ApiResponse.error("Estado 'CANCELADO' no encontrado"));
    await prisma.evento.update({ where: { id_evento: id }, data: { id_estado: estadoCancelado.id_estado } });
    return sendResponse(res, ApiResponse.deleted('Evento eliminado correctamente'));
  } catch (error) {
    console.error('Error deleting evento:', error);
    return sendResponse(res, ApiResponse.error('Error al eliminar evento', error));
  }
});

export default router;