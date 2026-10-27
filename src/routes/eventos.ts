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

// Listado de estados de eventos
router.get(
  "/listado/estados",
  authenticateToken,
  requirePermission("eventos", "leer"),
  async (req: AuthRequest, res: Response) => {
    try {
      const estados = await prisma.estado.findMany({
        where: { entidad: "EVENTO" },
        orderBy: { nombre: "asc" }
      });
      return sendResponse(res, ApiResponse.success(estados));
    } catch (error) {
      return sendResponse(res, ApiResponse.error('Error al obtener estados', error));
    }
  }
);

// Listado de congregaciones para eventos
router.get(
  "/listado/congregaciones",
  authenticateToken,
  requirePermission("eventos", "leer"),
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

// Listado de roles de servicio
router.get(
  "/listado/roles-servicio",
  authenticateToken,
  requirePermission("eventos", "leer"),
  async (req: AuthRequest, res: Response) => {
    try {
      const roles = await prisma.rolServicio.findMany({
        orderBy: { nombre: "asc" }
      });
      return sendResponse(res, ApiResponse.success(roles));
    } catch (error) {
      return sendResponse(res, ApiResponse.error('Error al obtener roles de servicio', error));
    }
  }
);

// Listado de miembros para asistencia/servicios (scoped por congregación)
router.get(
  "/listado/miembros",
  authenticateToken,
  requirePermission("eventos", "leer"),
  async (req: AuthRequest, res: Response) => {
    try {
      const congregacionFilter = getCongregacionFilter(req.user);
      const miembros = await prisma.miembro.findMany({
        where: { ...congregacionFilter },
        select: { id_miembro: true, nombres: true, apellidos: true },
        orderBy: { apellidos: "asc" }
      });
      return sendResponse(res, ApiResponse.success(miembros));
    } catch (error) {
      return sendResponse(res, ApiResponse.error('Error al obtener miembros', error));
    }
  }
);

// Listado de tipos de evento
router.get(
  "/listado/tipos",
  authenticateToken,
  requirePermission("eventos", "leer"),
  async (req: AuthRequest, res: Response) => {
    const tiposEvento = [
      { id: 'CULTO', nombre: 'Culto' },
      { id: 'ESCUELA', nombre: 'Escuela Dominical' },
      { id: 'JUVENIL', nombre: 'Juvenil' },
      { id: 'NIÑOS', nombre: 'Niños' },
      { id: 'OTRO', nombre: 'Otro' }
    ];
    return sendResponse(res, ApiResponse.success(tiposEvento));
  }
);

// ============================================
// CRUD
// ============================================

// GET all eventos
router.get('/', authenticateToken, requirePermission('eventos', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    const eventos = await prisma.evento.findMany({ 
      where: congregacionFilter, 
      include: { congregacion: true, estado: true }, 
      orderBy: { fecha_inicio: 'desc' } 
    });
    return sendResponse(res, ApiResponse.success(eventos));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener eventos', error));
  }
});

// GET eventos by estado
router.get('/estado/:idEstado', authenticateToken, requirePermission('eventos', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const idEstado = getNumericId(req.params.idEstado);
    if (idEstado === null) return sendResponse(res, ApiResponse.validationError('ID de estado inválido'));
    const estado = await prisma.estado.findUnique({ where: { id_estado: idEstado } });
    if (!estado) return sendResponse(res, ApiResponse.notFound('Estado no encontrado'));
    if (estado.entidad !== 'EVENTO') return sendResponse(res, ApiResponse.validationError('El estado no pertenece a EVENTO'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const eventos = await prisma.evento.findMany({ 
      where: { ...congregacionFilter, id_estado: idEstado }, 
      include: { congregacion: true, estado: true }, 
      orderBy: { fecha_inicio: 'desc' } 
    });
    return sendResponse(res, ApiResponse.success(eventos));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener eventos', error));
  }
});

// GET evento by ID
router.get('/:id', authenticateToken, requirePermission('eventos', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const evento = await prisma.evento.findFirst({ 
      where: { id_evento: id, ...congregacionFilter }, 
      include: { 
        congregacion: true, 
        estado: true, 
        asistencia: { include: { miembro: true } }
      } 
    });
    if (!evento) return sendResponse(res, ApiResponse.notFound('Evento no encontrado'));
    return sendResponse(res, ApiResponse.success(evento));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener evento', error));
  }
});

// POST create evento
router.post('/', authenticateToken, requirePermission('eventos', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, tipo, descripcion, fecha_inicio, fecha_fin, lugar, id_congregacion, capacidad_max, id_estado } = req.body;
    if (!nombre || !fecha_inicio || !id_estado) return sendResponse(res, ApiResponse.validationError('Faltan campos requeridos'));
    
    let congregacionId = id_congregacion;
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) congregacionId = req.user.id_congregacion;
    if (!congregacionId) return sendResponse(res, ApiResponse.validationError('Debe especificar una congregación'));
    
    const newEvento = await prisma.evento.create({
      data: { 
        nombre, 
        tipo, 
        descripcion, 
        fecha_inicio: new Date(fecha_inicio), 
        fecha_fin: fecha_fin ? new Date(fecha_fin) : null, 
        lugar, 
        id_congregacion: congregacionId, 
        capacidad_max: capacidad_max ? parseInt(capacidad_max) : null, 
        id_estado 
      },
      include: { congregacion: true, estado: true }
    });
    return sendResponse(res, ApiResponse.created(newEvento, 'Evento creado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al crear evento', error));
  }
});

// PUT update evento
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
    if (nivel !== 'ADMIN' && nivel !== 'SUPERADMIN' && updateData.id_congregacion) delete updateData.id_congregacion;
    
    const updatedEvento = await prisma.evento.update({ 
      where: { id_evento: id }, 
      data: updateData, 
      include: { congregacion: true, estado: true } 
    });
    return sendResponse(res, ApiResponse.updated(updatedEvento, 'Evento actualizado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al actualizar evento', error));
  }
});

// DELETE evento (logical deletion)
router.delete('/:id', authenticateToken, requirePermission('eventos', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const existingEvento = await prisma.evento.findFirst({ where: { id_evento: id, ...congregacionFilter } });
    if (!existingEvento) return sendResponse(res, ApiResponse.notFound('Evento no encontrado'));
    
    const estadoCancelado = await getEstadoByCodigo('EVENTO', 'CANCELADO');
    if (!estadoCancelado) return sendResponse(res, ApiResponse.error("Estado 'CANCELADO' no encontrado"));
    
    await prisma.evento.update({ 
      where: { id_evento: id }, 
      data: { id_estado: estadoCancelado.id_estado } 
    });
    return sendResponse(res, ApiResponse.deleted('Evento eliminado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al eliminar evento', error));
  }
});

// PATCH toggle status
router.patch('/:id/status', authenticateToken, requirePermission('eventos', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const congregacionFilter = getCongregacionFilter(req.user);
    const existingEvento = await prisma.evento.findFirst({ where: { id_evento: id, ...congregacionFilter } });
    if (!existingEvento) return sendResponse(res, ApiResponse.notFound('Evento no encontrado'));

    const estadoActivo = await getEstadoByCodigo('EVENTO', 'ACTIVO');
    const estadoInactivo = await getEstadoByCodigo('EVENTO', 'INACTIVO');
    if (!estadoActivo || !estadoInactivo) return sendResponse(res, ApiResponse.error("Estados no encontrados"));

    const nuevoEstado = existingEvento.id_estado === estadoActivo.id_estado ? estadoInactivo.id_estado : estadoActivo.id_estado;
    
    await prisma.evento.update({
      where: { id_evento: id },
      data: { id_estado: nuevoEstado }
    });

    const mensaje = nuevoEstado === estadoActivo.id_estado ? 'Evento activado correctamente' : 'Evento inactivado correctamente';
    return sendResponse(res, ApiResponse.success(null, mensaje));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al cambiar estado', error));
  }
});

// ============================================
// ASISTENCIA A EVENTOS
// ============================================

// Helper: verifica que el evento existe y es accesible por el usuario
const getEventoAccesible = async (req: AuthRequest, idEvento: number) => {
  const congregacionFilter = getCongregacionFilter(req.user);
  return prisma.evento.findFirst({ where: { id_evento: idEvento, ...congregacionFilter } });
};

// GET asistencia de un evento
router.get('/:id/asistencia', authenticateToken, requirePermission('eventos', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const evento = await getEventoAccesible(req, id);
    if (!evento) return sendResponse(res, ApiResponse.notFound('Evento no encontrado'));
    const asistencia = await prisma.asistenciaEvento.findMany({
      where: { id_evento: id },
      include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } } },
      orderBy: { hora_registro: 'desc' }
    });
    return sendResponse(res, ApiResponse.success(asistencia));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener asistencia', error));
  }
});

// POST registrar asistencia
router.post('/:id/asistencia', authenticateToken, requirePermission('eventos', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const evento = await getEventoAccesible(req, id);
    if (!evento) return sendResponse(res, ApiResponse.notFound('Evento no encontrado'));

    const { id_miembro, tipo_registro } = req.body;
    if (!id_miembro) return sendResponse(res, ApiResponse.validationError('Falta el miembro'));

    const existente = await prisma.asistenciaEvento.findFirst({ where: { id_evento: id, id_miembro: parseInt(String(id_miembro)) } });
    if (existente) return sendResponse(res, ApiResponse.validationError('El miembro ya está registrado en este evento'));

    const asistencia = await prisma.asistenciaEvento.create({
      data: { id_evento: id, id_miembro: parseInt(String(id_miembro)), tipo_registro: tipo_registro || 'presencial' },
      include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } } }
    });
    return sendResponse(res, ApiResponse.created(asistencia, 'Asistencia registrada correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al registrar asistencia', error));
  }
});

// DELETE quitar asistencia de un miembro
router.delete('/:id/asistencia/:idMiembro', authenticateToken, requirePermission('eventos', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    const idMiembro = getNumericId(req.params.idMiembro);
    if (id === null || idMiembro === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const evento = await getEventoAccesible(req, id);
    if (!evento) return sendResponse(res, ApiResponse.notFound('Evento no encontrado'));

    const existente = await prisma.asistenciaEvento.findFirst({ where: { id_evento: id, id_miembro: idMiembro } });
    if (!existente) return sendResponse(res, ApiResponse.notFound('Registro de asistencia no encontrado'));

    await prisma.asistenciaEvento.delete({ where: { id: existente.id } });
    return sendResponse(res, ApiResponse.deleted('Asistencia eliminada correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al eliminar asistencia', error));
  }
});

// ============================================
// SERVICIOS / EQUIPO DE TRABAJO DEL EVENTO
// ============================================

// GET servicios de un evento
router.get('/:id/servicios', authenticateToken, requirePermission('eventos', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const evento = await getEventoAccesible(req, id);
    if (!evento) return sendResponse(res, ApiResponse.notFound('Evento no encontrado'));
    const servicios = await prisma.servicio.findMany({
      where: { id_evento: id },
      include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, rol: true },
      orderBy: { fecha: 'desc' }
    });
    return sendResponse(res, ApiResponse.success(servicios));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener servicios', error));
  }
});

// POST asignar un miembro a un rol de servicio en el evento
router.post('/:id/servicios', authenticateToken, requirePermission('eventos', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const evento = await getEventoAccesible(req, id);
    if (!evento) return sendResponse(res, ApiResponse.notFound('Evento no encontrado'));

    const { id_miembro, id_rol, observaciones } = req.body;
    if (!id_miembro || !id_rol) return sendResponse(res, ApiResponse.validationError('Faltan campos requeridos'));

    const existente = await prisma.servicio.findFirst({ where: { id_evento: id, id_miembro: parseInt(String(id_miembro)), id_rol: parseInt(String(id_rol)) } });
    if (existente) return sendResponse(res, ApiResponse.validationError('El miembro ya tiene asignado ese rol en el evento'));

    const servicio = await prisma.servicio.create({
      data: { id_evento: id, id_miembro: parseInt(String(id_miembro)), id_rol: parseInt(String(id_rol)), observaciones: observaciones || null },
      include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, rol: true }
    });
    return sendResponse(res, ApiResponse.created(servicio, 'Servicio asignado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al asignar servicio', error));
  }
});

// DELETE quitar un servicio
router.delete('/:id/servicios/:idServicio', authenticateToken, requirePermission('eventos', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    const idServicio = getNumericId(req.params.idServicio);
    if (id === null || idServicio === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const evento = await getEventoAccesible(req, id);
    if (!evento) return sendResponse(res, ApiResponse.notFound('Evento no encontrado'));

    const existente = await prisma.servicio.findFirst({ where: { id_servicio: idServicio, id_evento: id } });
    if (!existente) return sendResponse(res, ApiResponse.notFound('Servicio no encontrado'));

    await prisma.servicio.delete({ where: { id_servicio: idServicio } });
    return sendResponse(res, ApiResponse.deleted('Servicio eliminado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al eliminar servicio', error));
  }
});

export default router;