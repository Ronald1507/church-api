import { Router, Request, Response } from 'express';
import prisma from '../config/db';
import bcrypt from 'bcrypt';
import { authenticateToken, AuthRequest } from '../middleware/auth';
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
router.get('/opciones', authenticateToken, requirePermission('usuarios', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const estadoActivo = await getEstadoByCodigo('MIEMBRO', 'ACTIVO');
    const miembroFilter = estadoActivo ? { id_estado: estadoActivo.id_estado } : {};
    const [roles, estados, miembros, congregaciones] = await Promise.all([
      prisma.rolSistema.findMany({ orderBy: { nombre: 'asc' } }),
      prisma.estado.findMany({ where: { entidad: 'USUARIO' }, orderBy: { nombre: 'asc' } }),
      prisma.miembro.findMany({ where: miembroFilter, orderBy: { nombres: 'asc' } }),
      prisma.congregacion.findMany({ include: { estado: true }, orderBy: { nombre: 'asc' } })
    ]);
    return sendResponse(res, ApiResponse.success({ roles, estados, miembros, congregaciones }));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener metadatos', error));
  }
});

// Get all users
router.get('/', authenticateToken, requirePermission('usuarios', 'leer'), async (req: AuthRequest, res: Response) => {
  const { nivel, id_congregacion } = req.user || {};
  const where = nivel === 'SUPERADMIN' ? {} : { id_congregacion: id_congregacion || undefined };
  if (nivel === 'ADMIN' && !id_congregacion) return sendResponse(res, ApiResponse.success([]));
  try {
    const usuarios = await prisma.usuarioSistema.findMany({ where, include: { rol: true, estado: true, congregacion: true }, orderBy: { username: 'asc' } });
    return sendResponse(res, ApiResponse.success(usuarios));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener usuarios', error));
  }
});

// Get users by estado
router.get('/estado/:idEstado', authenticateToken, requirePermission('usuarios', 'leer'), async (req: AuthRequest, res: Response) => {
  const { nivel, id_congregacion } = req.user || {};
  const idEstado = getNumericId(req.params.idEstado);
  if (idEstado === null) return sendResponse(res, ApiResponse.validationError('ID de estado inválido'));
  const estado = await prisma.estado.findUnique({ where: { id_estado: idEstado } });
  if (!estado) return sendResponse(res, ApiResponse.notFound('Estado no encontrado'));
  if (estado.entidad !== 'USUARIO') return sendResponse(res, ApiResponse.validationError('El estado no pertenece a USUARIO'));
  if (nivel === 'ADMIN' && !id_congregacion) return sendResponse(res, ApiResponse.success([]));
  const usersWhere = nivel === 'SUPERADMIN' ? { id_estado: idEstado } : { id_congregacion: id_congregacion || undefined, id_estado: idEstado };
  try {
    const usuarios = await prisma.usuarioSistema.findMany({ where: usersWhere, include: { rol: true, estado: true, congregacion: true }, orderBy: { username: 'asc' } });
    return sendResponse(res, ApiResponse.success(usuarios));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener usuarios', error));
  }
});

// Get user by ID
router.get('/:id', authenticateToken, requirePermission('usuarios', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const usuario = await prisma.usuarioSistema.findUnique({ where: { id_usuario: id }, include: { rol: true, estado: true, congregacion: true } });
    if (!usuario) return sendResponse(res, ApiResponse.notFound('Usuario no encontrado'));
    return sendResponse(res, ApiResponse.success(usuario));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener usuario', error));
  }
});

// Create user
router.post('/', authenticateToken, requirePermission('usuarios', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, password, id_rol, id_estado, id_congregacion, id_miembro } = req.body;
    if (!username || !email || !password || !id_rol || !id_estado) return sendResponse(res, ApiResponse.validationError('Faltan campos requeridos'));
    const existingUser = await prisma.usuarioSistema.findFirst({ where: { OR: [{ username }, { email }] } });
    if (existingUser) return sendResponse(res, ApiResponse.validationError('Usuario o email ya existe'));
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUsuario = await prisma.usuarioSistema.create({
      data: { username, email, password_hash: hashedPassword, id_rol: parseInt(id_rol), id_estado: parseInt(id_estado), id_congregacion: id_congregacion ? parseInt(id_congregacion) : null, id_miembro: id_miembro ? parseInt(id_miembro) : null },
      include: { rol: true, estado: true, congregacion: true }
    });
    return sendResponse(res, ApiResponse.created(newUsuario, 'Usuario creado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al crear usuario', error));
  }
});

// Update user
router.put('/:id', authenticateToken, requirePermission('usuarios', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    const { password, ...updateData } = req.body;
    if (password) updateData.password_hash = await bcrypt.hash(password, 10);
    if (updateData.id_rol) updateData.id_rol = parseInt(updateData.id_rol);
    if (updateData.id_estado) updateData.id_estado = parseInt(updateData.id_estado);
    if (updateData.id_congregacion) updateData.id_congregacion = parseInt(updateData.id_congregacion);
    if (updateData.id_miembro) updateData.id_miembro = parseInt(updateData.id_miembro);
    const updatedUsuario = await prisma.usuarioSistema.update({ where: { id_usuario: id }, data: updateData, include: { rol: true, estado: true, congregacion: true } });
    return sendResponse(res, ApiResponse.updated(updatedUsuario, 'Usuario actualizado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al actualizar usuario', error));
  }
});

// Delete user
router.delete('/:id', authenticateToken, requirePermission('usuarios', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) return sendResponse(res, ApiResponse.validationError('ID inválido'));
    if (id === req.user?.userId) return sendResponse(res, ApiResponse.validationError('No puedes eliminar tu propio usuario'));
    const estadoInactivo = await getEstadoByCodigo('USUARIO', 'INACTIVO');
    if (!estadoInactivo) return sendResponse(res, ApiResponse.error("Estado 'INACTIVO' no encontrado"));
    await prisma.usuarioSistema.update({ where: { id_usuario: id }, data: { id_estado: estadoInactivo.id_estado } });
    return sendResponse(res, ApiResponse.deleted('Usuario eliminado correctamente'));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al eliminar usuario', error));
  }
});

export default router;