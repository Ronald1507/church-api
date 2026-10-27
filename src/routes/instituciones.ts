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

// ============================================
// LISTADOS SEPARADOS (uno para cada cosa)
// ============================================

// Listado de estados de instituciones
router.get(
  "/listado/estados",
  authenticateToken,
  requirePermission("instituciones", "leer"),
  async (req: AuthRequest, res: Response) => {
    try {
      const estados = await prisma.estado.findMany({
        where: { entidad: "INSTITUCION" },
        orderBy: { nombre: "asc" }
      });
      return sendResponse(res, ApiResponse.success(estados));
    } catch (error) {
      return sendResponse(res, ApiResponse.error('Error al obtener estados', error));
    }
  }
);

// Listado de congregaciones para instituciones
router.get(
  "/listado/congregaciones",
  authenticateToken,
  requirePermission("instituciones", "leer"),
  async (req: AuthRequest, res: Response) => {
    try {
      const congregacionFilter = getCongregacionFilter(req.user);
      const congregaciones = await prisma.congregacion.findMany({
        where: congregacionFilter,
        include: { estado: true },
        orderBy: { nombre: "asc" }
      });
      return sendResponse(res, ApiResponse.success(congregaciones));
    } catch (error) {
      return sendResponse(res, ApiResponse.error('Error al obtener congregaciones', error));
    }
  }
);

// Listado de tipos de institución
router.get(
  "/listado/tipos",
  authenticateToken,
  requirePermission("instituciones", "leer"),
  async (req: AuthRequest, res: Response) => {
    const tiposInstitucion = [
      { id: 'CORO', nombre: 'Coro' },
      { id: 'JOVENES', nombre: 'Jóvenes' },
      { id: 'DORCAS', nombre: 'Dorcas' },
      { id: 'ESCUELA_DOMINICAL', nombre: 'Escuela Dominical' },
      { id: 'GUARDERIA', nombre: 'Guardería' },
      { id: 'OTRO', nombre: 'Otro' }
    ];
    return sendResponse(res, ApiResponse.success(tiposInstitucion));
  }
);

// ============================================
// CRUD
// ============================================

// GET all instituciones
router.get('/', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    const instituciones = await prisma.institucion.findMany({ 
      where: congregacionFilter, 
      include: { 
        congregacion: true, 
        estado: true,
        _count: { select: { miembroInstitucions: true } }
      }, 
      orderBy: { nombre: 'asc' } 
    });
    return sendResponse(res, ApiResponse.success(instituciones));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener instituciones', error));
  }
});

// GET instituciones by estado
router.get('/estado/:idEstado', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const idEstado = getNumericId(req.params.idEstado);
    if (idEstado === null) return sendResponse(res, ApiResponse.validationError('ID de estado inválido'));
    const estado = await prisma.estado.findUnique({ where: { id_estado: idEstado } });
    if (!estado) return sendResponse(res, ApiResponse.notFound('Estado no encontrado'));
    if (estado.entidad !== 'INSTITUCION') return sendResponse(res, ApiResponse.validationError('El estado no pertenece a INSTITUCION'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const instituciones = await prisma.institucion.findMany({ 
      where: { ...congregacionFilter, id_estado: idEstado }, 
      include: { congregacion: true, estado: true, _count: { select: { miembroInstitucions: true } } }, 
      orderBy: { nombre: 'asc' } 
    });
    return sendResponse(res, ApiResponse.success(instituciones));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener instituciones', error));
  }
});

// GET institucion by ID
router.get('/:id', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const institucion = await prisma.institucion.findFirst({ 
      where: { id_institucion: id, ...congregacionFilter }, 
      include: { 
        congregacion: true, 
        estado: true, 
        miembroInstitucions: { 
          include: { miembro: true, estado: true },
          orderBy: { fecha_ingreso: 'desc' }
        },
        cargoInstitucions: {
          include: { miembro: true, estado: true },
          where: { fecha_fin: null }
        }
      } 
    });
    if (!institucion) return sendResponse(res, ApiResponse.notFound('Institución no encontrada'));
    return sendResponse(res, ApiResponse.success(institucion));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener institución', error));
  }
});

// POST create institucion
router.post('/', authenticateToken, requirePermission('instituciones', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, tipo, descripcion, id_congregacion, id_estado } = req.body;
    if (!nombre || !id_estado) return sendResponse(res, ApiResponse.validationError('Faltan campos requeridos'));
    
    let congregacionId = id_congregacion;
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) congregacionId = req.user.id_congregacion;
    if (!congregacionId) return sendResponse(res, ApiResponse.validationError('Debe especificar una congregación'));
    
    const newInstitucion = await prisma.institucion.create({ 
      data: { nombre, tipo, descripcion, id_congregacion: congregacionId, id_estado }, 
      include: { congregacion: true, estado: true } 
    });
    return sendResponse(res, ApiResponse.created(newInstitucion, 'Institución creada correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al crear institución', error));
  }
});

// PUT update institucion
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
    if (nivel !== 'ADMIN' && nivel !== 'SUPERADMIN' && updateData.id_congregacion) delete updateData.id_congregacion;
    
    const updatedInstitucion = await prisma.institucion.update({ 
      where: { id_institucion: id }, 
      data: updateData, 
      include: { congregacion: true, estado: true } 
    });
    return sendResponse(res, ApiResponse.updated(updatedInstitucion, 'Institución actualizada correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al actualizar institución', error));
  }
});

// DELETE institucion (logical deletion)
router.delete('/:id', authenticateToken, requirePermission('instituciones', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const existingInstitucion = await prisma.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter } });
    if (!existingInstitucion) return sendResponse(res, ApiResponse.notFound('Institución no encontrada'));
    
    const estadoInactiva = await getEstadoByCodigo('INSTITUCION', 'INACTIVA');
    if (!estadoInactiva) return sendResponse(res, ApiResponse.error("Estado 'INACTIVA' no encontrado"));
    
    await prisma.institucion.update({ 
      where: { id_institucion: id }, 
      data: { id_estado: estadoInactiva.id_estado } 
    });
    return sendResponse(res, ApiResponse.deleted('Institución eliminada correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al eliminar institución', error));
  }
});

// PATCH toggle status
router.patch('/:id/status', authenticateToken, requirePermission('instituciones', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const existingInstitucion = await prisma.institucion.findFirst({ where: { id_institucion: id, ...congregacionFilter } });
    if (!existingInstitucion) return sendResponse(res, ApiResponse.notFound('Institución no encontrada'));

    const estadoActivo = await getEstadoByCodigo('INSTITUCION', 'ACTIVA');
    const estadoInactivo = await getEstadoByCodigo('INSTITUCION', 'INACTIVA');
    if (!estadoActivo || !estadoInactivo) return sendResponse(res, ApiResponse.error("Estados no encontrados"));

    const nuevoEstado = existingInstitucion.id_estado === estadoActivo.id_estado ? estadoInactivo.id_estado : estadoActivo.id_estado;
    
    await prisma.institucion.update({
      where: { id_institucion: id },
      data: { id_estado: nuevoEstado }
    });

    const mensaje = nuevoEstado === estadoActivo.id_estado ? 'Institución activada correctamente' : 'Institución inactivada correctamente';
    return sendResponse(res, ApiResponse.success(null, mensaje));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al cambiar estado', error));
  }
});

// ============================================
// CARGOS DE INSTITUCIÓN (directiva / liderazgo)
// ============================================

const getInstitucionAccesible = async (req: AuthRequest, idInstitucion: number) => {
  const congregacionFilter = getCongregacionFilter(req.user);
  return prisma.institucion.findFirst({ where: { id_institucion: idInstitucion, ...congregacionFilter } });
};

// GET cargos de una institución (por defecto solo vigentes; ?historial=true para todos)
router.get('/:id/cargos', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const institucion = await getInstitucionAccesible(req, id);
    if (!institucion) return sendResponse(res, ApiResponse.notFound('Institución no encontrada'));

    const incluirHistorial = String(req.query.historial) === 'true';
    const cargos = await prisma.cargoInstitucion.findMany({
      where: { id_institucion: id, ...(incluirHistorial ? {} : { fecha_fin: null }) },
      include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
      orderBy: { fecha_inicio: 'desc' }
    });
    return sendResponse(res, ApiResponse.success(cargos));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener cargos', error));
  }
});

// POST crear cargo
router.post('/:id/cargos', authenticateToken, requirePermission('instituciones', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const institucion = await getInstitucionAccesible(req, id);
    if (!institucion) return sendResponse(res, ApiResponse.notFound('Institución no encontrada'));

    const { id_miembro, rol, fecha_inicio } = req.body;
    if (!id_miembro || !rol) return sendResponse(res, ApiResponse.validationError('Faltan campos requeridos'));

    const estadoActivo = await getEstadoByCodigo('CARGO_INSTITUCION', 'ACTIVO');
    if (!estadoActivo) return sendResponse(res, ApiResponse.error("Estado 'ACTIVO' de CARGO_INSTITUCION no encontrado. Ejecute el seed."));

    const cargo = await prisma.cargoInstitucion.create({
      data: {
        id_miembro: parseInt(String(id_miembro)),
        id_institucion: id,
        rol,
        fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : new Date(),
        id_estado: estadoActivo.id_estado,
      },
      include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true }
    });
    return sendResponse(res, ApiResponse.created(cargo, 'Cargo asignado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al asignar cargo', error));
  }
});

// PUT actualizar cargo
router.put('/cargos/:idCargo', authenticateToken, requirePermission('instituciones', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const idCargo = getNumericId(req.params.idCargo);
    if (idCargo === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const existing = await prisma.cargoInstitucion.findFirst({ where: { id_cargo: idCargo, institucion: { ...congregacionFilter } } });
    if (!existing) return sendResponse(res, ApiResponse.notFound('Cargo no encontrado'));

    const input = req.body;
    const updateData: Record<string, unknown> = {};
    if (input.rol !== undefined) updateData.rol = input.rol;
    if (input.fecha_inicio !== undefined && input.fecha_inicio) updateData.fecha_inicio = new Date(input.fecha_inicio);
    if (input.fecha_fin !== undefined) updateData.fecha_fin = input.fecha_fin ? new Date(input.fecha_fin) : null;
    if (input.id_estado !== undefined && input.id_estado) updateData.id_estado = parseInt(String(input.id_estado));

    const cargo = await prisma.cargoInstitucion.update({
      where: { id_cargo: idCargo },
      data: updateData,
      include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true }
    });
    return sendResponse(res, ApiResponse.updated(cargo, 'Cargo actualizado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al actualizar cargo', error));
  }
});

// DELETE finalizar cargo (cierra el período y marca FINALIZADO)
router.delete('/cargos/:idCargo', authenticateToken, requirePermission('instituciones', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const idCargo = getNumericId(req.params.idCargo);
    if (idCargo === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const existing = await prisma.cargoInstitucion.findFirst({ where: { id_cargo: idCargo, institucion: { ...congregacionFilter } } });
    if (!existing) return sendResponse(res, ApiResponse.notFound('Cargo no encontrado'));

    const estadoFinalizado = await getEstadoByCodigo('CARGO_INSTITUCION', 'FINALIZADO');
    if (!estadoFinalizado) return sendResponse(res, ApiResponse.error("Estado 'FINALIZADO' no encontrado"));

    await prisma.cargoInstitucion.update({
      where: { id_cargo: idCargo },
      data: { fecha_fin: new Date(), id_estado: estadoFinalizado.id_estado }
    });
    return sendResponse(res, ApiResponse.deleted('Cargo finalizado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al finalizar cargo', error));
  }
});

export default router;