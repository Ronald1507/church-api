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
router.get('/opciones', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    let congregacionFilter = {};
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) congregacionFilter = { id_congregacion: req.user.id_congregacion };
    const [estados, congregaciones] = await Promise.all([
      prisma.estado.findMany({ where: { entidad: 'INSTITUCION' }, orderBy: { nombre: 'asc' } }),
      prisma.congregacion.findMany({ where: congregacionFilter, include: { estado: true }, orderBy: { nombre: 'asc' } })
    ]);
    const tiposInstitucion = [
      { id: 'CORO', nombre: 'Coro' }, { id: 'JOVENES', nombre: 'Jóvenes' }, { id: 'DORCAS', nombre: 'Dorcas' },
      { id: 'ESCUELA_DOMINICAL', nombre: 'Escuela Dominical' }, { id: 'GUARDERIA', nombre: 'Guardería' }, { id: 'OTRO', nombre: 'Otro' }
    ];
    return sendResponse(res, ApiResponse.success({ estados, congregaciones, tipos: tiposInstitucion }));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener metadatos', error));
  }
});

// Get all instituciones
router.get('/', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    const instituciones = await prisma.institucion.findMany({ where: congregacionFilter, include: { congregacion: true, estado: true }, orderBy: { nombre: 'asc' } });
    return sendResponse(res, ApiResponse.success(instituciones));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener instituciones', error));
  }
});

router.get('/estado/:idEstado', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const idEstado = getNumericId(req.params.idEstado);
    if (idEstado === null) return sendResponse(res, ApiResponse.validationError('ID de estado inválido'));
    const estado = await prisma.estado.findUnique({ where: { id_estado: idEstado } });
    if (!estado) return sendResponse(res, ApiResponse.notFound('Estado no encontrado'));
    if (estado.entidad !== 'INSTITUCION') return sendResponse(res, ApiResponse.validationError('El estado no pertenece a INSTITUCION'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const instituciones = await prisma.institucion.findMany({ where: { ...congregacionFilter, id_estado: idEstado }, include: { congregacion: true, estado: true }, orderBy: { nombre: 'asc' } });
    return sendResponse(res, ApiResponse.success(instituciones));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener instituciones', error));
  }
});

router.get('/:id', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const institucion = await prisma.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter }, include: { congregacion: true, estado: true, miembroInstitucions: { include: { miembro: true, estado: true } } } });
    if (!institucion) return sendResponse(res, ApiResponse.notFound('Institución no encontrada'));
    return sendResponse(res, ApiResponse.success(institucion));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener institución', error));
  }
});

router.post('/', authenticateToken, requirePermission('instituciones', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, tipo, descripcion, id_congregacion, id_estado } = req.body;
    if (!nombre || !id_estado) return sendResponse(res, ApiResponse.validationError('Faltan campos requeridos'));
    let congregacionId = id_congregacion;
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) congregacionId = req.user.id_congregacion;
    if (!congregacionId) return sendResponse(res, ApiResponse.validationError('Debe especificar una congregación'));
    const newInstitucion = await prisma.institucion.create({ data: { nombre, tipo, descripcion, id_congregacion: congregacionId, id_estado }, include: { congregacion: true, estado: true } });
    return sendResponse(res, ApiResponse.created(newInstitucion, 'Institución creada correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al crear institución', error));
  }
});

router.put('/:id', authenticateToken, requirePermission('instituciones', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const existingInstitucion = await prisma.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter } });
    if (!existingInstitucion) return sendResponse(res, ApiResponse.notFound('Institución no encontrada'));
    const updateData = { ...req.body };
    delete updateData.id_institucion;
    delete updateData.created_at;
    delete updateData.updated_at;
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && updateData.id_congregacion) delete updateData.id_congregacion;
    const updatedInstitucion = await prisma.institucion.update({ where: { id_institucion: id }, data: updateData, include: { congregacion: true, estado: true } });
    return sendResponse(res, ApiResponse.updated(updatedInstitucion, 'Institución actualizada correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al actualizar institución', error));
  }
});

router.delete('/:id', authenticateToken, requirePermission('instituciones', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const existingInstitucion = await prisma.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter } });
    if (!existingInstitucion) return sendResponse(res, ApiResponse.notFound('Institución no encontrada'));
    const estadoInactiva = await getEstadoByCodigo('INSTITUCION', 'INACTIVA');
    if (!estadoInactiva) return sendResponse(res, ApiResponse.error("Estado 'INACTIVA' no encontrado"));
    await prisma.institucion.update({ where: { id_institucion: id }, data: { id_estado: estadoInactiva.id_estado } });
    return sendResponse(res, ApiResponse.deleted('Institución eliminada correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al eliminar institución', error));
  }
});

// Miembros de institución
router.get('/:id/miembros', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const institucion = await prisma.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter } });
    if (!institucion) return sendResponse(res, ApiResponse.notFound('Institución no encontrada'));
    const miembros = await prisma.miembroInstitucion.findMany({ where: { id_institucion: id }, include: { miembro: true, estado: true }, orderBy: { fecha_ingreso: 'desc' } });
    const cargos = await prisma.cargoInstitucion.findMany({ where: { id_institucion: id, fecha_fin: null }, include: { miembro: true, estado: true } });
    return sendResponse(res, ApiResponse.success({ miembros, cargos }));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener miembros', error));
  }
});

router.post('/:id/miembros', authenticateToken, requirePermission('instituciones', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const { id_miembro, rol } = req.body;
    if (!id_miembro) return sendResponse(res, ApiResponse.validationError('ID de miembro requerido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const institucion = await prisma.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter } });
    if (!institucion) return sendResponse(res, ApiResponse.notFound('Institución no encontrada'));
    const miembro = await prisma.miembro.findFirst({ where: { id_miembro, ...congregacionFilter } });
    if (!miembro) return sendResponse(res, ApiResponse.notFound('Miembro no encontrado en esta congregación'));
    const estadoActivo = await getEstadoByCodigo('MIEMBRO', 'ACTIVO');
    if (!estadoActivo) return sendResponse(res, ApiResponse.error("Estado 'ACTIVO' no encontrado"));
    const newRelacion = await prisma.miembroInstitucion.create({ data: { id_miembro, id_institucion: id, rol: rol || 'MIEMBRO', id_estado: estadoActivo.id_estado, fecha_ingreso: new Date() }, include: { miembro: true, institucion: true } });
    return sendResponse(res, ApiResponse.created(newRelacion, 'Miembro agregado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al agregar miembro', error));
  }
});

router.post('/:id/cargos', authenticateToken, requirePermission('instituciones', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const { id_miembro, rol, fecha_inicio } = req.body;
    if (!id_miembro || !rol) return sendResponse(res, ApiResponse.validationError('ID de miembro y rol requeridos'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const institucion = await prisma.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter } });
    if (!institucion) return sendResponse(res, ApiResponse.notFound('Institución no encontrada'));
    const miembroInstitucion = await prisma.miembroInstitucion.findFirst({ where: { id_miembro, id_institucion: id } });
    if (!miembroInstitucion) return sendResponse(res, ApiResponse.validationError('El miembro no pertenece a esta institución'));
    const estadoActivo = await getEstadoByCodigo('MIEMBRO', 'ACTIVO');
    if (!estadoActivo) return sendResponse(res, ApiResponse.error("Estado 'ACTIVO' no encontrado"));
    await prisma.cargoInstitucion.updateMany({ where: { id_miembro, id_institucion: id, fecha_fin: null }, data: { fecha_fin: new Date() } });
    const newCargo = await prisma.cargoInstitucion.create({ data: { id_miembro, id_institucion: id, rol, fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : new Date(), id_estado: estadoActivo.id_estado }, include: { miembro: true, institucion: true } });
    return sendResponse(res, ApiResponse.created(newCargo, 'Cargo asignado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al asignar cargo', error));
  }
});

router.delete('/:id/miembros/:idMiembro', authenticateToken, requirePermission('instituciones', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    const idMiembroParam = req.params.idMiembro;
    const idMiembro = typeof idMiembroParam === 'string' ? parseInt(idMiembroParam) : parseInt(Array.isArray(idMiembroParam) ? idMiembroParam[0] : '');
    if (id === null || isNaN(idMiembro)) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const institucion = await prisma.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter } });
    if (!institucion) return sendResponse(res, ApiResponse.notFound('Institución no encontrada'));
    await prisma.miembroInstitucion.deleteMany({ where: { id_miembro: idMiembro, id_institucion: id } });
    await prisma.cargoInstitucion.deleteMany({ where: { id_miembro: idMiembro, id_institucion: id } });
    return sendResponse(res, ApiResponse.deleted('Miembro removido correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al remover miembro', error));
  }
});

export default router;