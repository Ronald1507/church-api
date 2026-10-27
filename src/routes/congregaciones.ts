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

// Listado: Estados
router.get('/listado/estados', authenticateToken, requirePermission('configuracion', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const estados = await prisma.estado.findMany({ where: { entidad: 'CONGREGACION' }, orderBy: { nombre: 'asc' } });
    return sendResponse(res, ApiResponse.success(estados));
  } catch (error) {
    console.error('Get estados error:', error);
    return sendResponse(res, ApiResponse.error('Error al obtener estados', error));
  }
});

// Get all congregaciones
router.get('/', authenticateToken, requirePermission('configuracion', 'leer'), async (req: AuthRequest, res: Response) => {
  const { nivel, id_congregacion } = req.user || {};

  if (nivel !== 'SUPERADMIN') {
    if (nivel === 'ADMIN' && id_congregacion) {
      const congregacion = await prisma.congregacion.findUnique({ where: { id_congregacion }, include: { estado: true } });
      return sendResponse(res, ApiResponse.success(congregacion ? [congregacion] : []));
    }
    return sendResponse(res, ApiResponse.success([]));
  }

  try {
    const congregaciones = await prisma.congregacion.findMany({ include: { estado: true }, orderBy: { nombre: 'asc' } });
    return sendResponse(res, ApiResponse.success(congregaciones));
  } catch (error) {
    console.error('Error getting congregaciones:', error);
    return sendResponse(res, ApiResponse.error('Error al obtener congregaciones', error));
  }
});

// Get congregaciones by estado
router.get('/estado/:idEstado', authenticateToken, requirePermission('configuracion', 'leer'), async (req: AuthRequest, res: Response) => {
  const { nivel, id_congregacion } = req.user || {};
  const idEstado = getNumericId(req.params.idEstado);
  
  if (idEstado === null) {
    return sendResponse(res, ApiResponse.validationError('ID de estado inválido'));
  }

  const estado = await prisma.estado.findUnique({ where: { id_estado: idEstado } });
  if (!estado) {
    return sendResponse(res, ApiResponse.notFound('Estado no encontrado'));
  }
  if (estado.entidad !== 'CONGREGACION') {
    return sendResponse(res, ApiResponse.validationError(`El estado ${idEstado} no pertenece a la entidad CONGREGACION`));
  }

  if (nivel !== 'SUPERADMIN') {
    if (nivel === 'ADMIN' && id_congregacion) {
      const congregacion = await prisma.congregacion.findUnique({ where: { id_congregacion, id_estado: idEstado }, include: { estado: true } });
      return sendResponse(res, ApiResponse.success(congregacion ? [congregacion] : []));
    }
    return sendResponse(res, ApiResponse.success([]));
  }

  try {
    const congregaciones = await prisma.congregacion.findMany({ where: { id_estado: idEstado }, include: { estado: true }, orderBy: { nombre: 'asc' } });
    return sendResponse(res, ApiResponse.success(congregaciones));
  } catch (error) {
    console.error('Error getting congregaciones by estado:', error);
    return sendResponse(res, ApiResponse.error('Error al obtener congregaciones', error));
  }
});

// Get congregacion by ID
router.get('/:id', authenticateToken, requirePermission('configuracion', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return sendResponse(res, ApiResponse.validationError('ID inválido'));
    }

    const { nivel, id_congregacion } = req.user || {};
    if (nivel !== 'SUPERADMIN' && (nivel !== 'ADMIN' || id_congregacion !== id)) {
      return sendResponse(res, ApiResponse.forbidden('No tienes acceso a esta congregación'));
    }
    
    const congregacion = await prisma.congregacion.findUnique({
      where: { id_congregacion: id },
      include: { estado: true, miembros: true, institucions: true, eventos: true, finanzasCuentas: true, inventarioItems: true, presupuestos: true, comunicaciones: true }
    });

    if (!congregacion) {
      return sendResponse(res, ApiResponse.notFound('Congregación no encontrada'));
    }

    return sendResponse(res, ApiResponse.success(congregacion));
  } catch (error) {
    console.error('Error getting congregacion:', error);
    return sendResponse(res, ApiResponse.error('Error al obtener congregación', error));
  }
});

// Create congregacion
router.post('/', authenticateToken, requirePermission('configuracion', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, direccion, ciudad, region, id_pastor, telefono, email, id_estado } = req.body;

    if (!nombre || !id_estado) {
      return sendResponse(res, ApiResponse.validationError('Faltan campos requeridos'));
    }

    const newCongregacion = await prisma.congregacion.create({
      data: { nombre, direccion, ciudad, region, id_pastor: id_pastor ? parseInt(id_pastor) : null, telefono, email, id_estado },
      include: { estado: true }
    });

    return sendResponse(res, ApiResponse.created(newCongregacion, 'Congregación creada correctamente'));
  } catch (error) {
    console.error('Error creating congregacion:', error);
    return sendResponse(res, ApiResponse.error('Error al crear congregación', error));
  }
});

// Update congregacion
router.put('/:id', authenticateToken, requirePermission('configuracion', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return sendResponse(res, ApiResponse.validationError('ID inválido'));
    }
    
    const updateData = { ...req.body };
    delete updateData.id_congregacion;
    delete updateData.created_at;
    delete updateData.updated_at;

    const updatedCongregacion = await prisma.congregacion.update({ where: { id_congregacion: id }, data: updateData, include: { estado: true } });
    return sendResponse(res, ApiResponse.updated(updatedCongregacion, 'Congregación actualizada correctamente'));
  } catch (error) {
    console.error('Error updating congregacion:', error);
    return sendResponse(res, ApiResponse.error('Error al actualizar congregación', error));
  }
});

// Delete congregacion
router.delete('/:id', authenticateToken, requirePermission('configuracion', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return sendResponse(res, ApiResponse.validationError('ID inválido'));
    }
    
    const estadoInactiva = await getEstadoByCodigo('CONGREGACION', 'INACTIVA');
    if (!estadoInactiva) {
      return sendResponse(res, ApiResponse.error("Estado 'INACTIVA' no encontrado"));
    }

    await prisma.congregacion.update({ where: { id_congregacion: id }, data: { id_estado: estadoInactiva.id_estado } });
    return sendResponse(res, ApiResponse.deleted('Congregación eliminada correctamente'));
  } catch (error) {
    console.error('Error deleting congregacion:', error);
    return sendResponse(res, ApiResponse.error('Error al eliminar congregación', error));
  }
});

export default router;