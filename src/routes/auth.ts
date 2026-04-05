import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getEstadoByCodigo } from '../utils/estados';
import { ApiResponse, sendResponse } from '../utils/response';

const router = Router();

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body;
    const loginIdentifier = email || username;
    
    if (!loginIdentifier || !password) {
      return sendResponse(res, ApiResponse.validationError('Email/Usuario y contraseña requeridos'));
    }

    const user = await prisma.usuarioSistema.findFirst({
      where: { OR: [{ email: loginIdentifier }, { username: loginIdentifier }] },
      include: { rol: true, estado: true, congregacion: true }
    });

    if (!user) {
      return sendResponse(res, ApiResponse.unauthorized('Credenciales inválidas'));
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return sendResponse(res, ApiResponse.unauthorized('Credenciales inválidas'));
    }

    await prisma.usuarioSistema.update({
      where: { id_usuario: user.id_usuario },
      data: { ultimo_acceso: new Date() }
    });

    const token = jwt.sign(
      { userId: user.id_usuario, username: user.username, nivel: user.nivel || 'USUARIO', id_congregacion: user.id_congregacion },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { userId: user.id_usuario },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    return sendResponse(res, ApiResponse.success({ token, refreshToken, user: { id: user.id_usuario, username: user.username, email: user.email, nivel: user.nivel || 'USUARIO', id_congregacion: user.id_congregacion } }, 'Login exitoso'));
  } catch (error) {
    console.error('Login error:', error);
    return sendResponse(res, ApiResponse.error('Error en el login', error));
  }
});

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, email, id_rol, id_miembro } = req.body;

    if (!username || !password || !email) {
      return sendResponse(res, ApiResponse.validationError('Usuario, contraseña y email requeridos'));
    }

    const existingUser = await prisma.usuarioSistema.findFirst({
      where: { OR: [{ username }, { email }] }
    });

    if (existingUser) {
      return sendResponse(res, ApiResponse.validationError('Usuario o email ya existe'));
    }

    const role = await prisma.rolSistema.findUnique({ where: { id_rol: id_rol || 2 } });
    if (!role) {
      return sendResponse(res, ApiResponse.validationError('Rol inválido'));
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const roleId = id_rol || 2;

    const estadoActivo = await getEstadoByCodigo('USUARIO', 'ACTIVO');
    if (!estadoActivo) {
      return sendResponse(res, ApiResponse.error("Estado 'ACTIVO' no encontrado"));
    }

    const newUser = await prisma.usuarioSistema.create({
      data: { username, password_hash: hashedPassword, email, id_rol: roleId, id_estado: estadoActivo.id_estado, id_miembro: id_miembro || null },
      include: { rol: true }
    });

    return sendResponse(res, ApiResponse.created({ id: newUser.id_usuario, username: newUser.username, email: newUser.email, role: newUser.rol.nombre }, 'Usuario registrado correctamente'));
  } catch (error) {
    console.error('Register error:', error);
    return sendResponse(res, ApiResponse.error('Error en el registro', error));
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendResponse(res, ApiResponse.validationError('Token de actualización requerido'));
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret') as { userId: number };

    const user = await prisma.usuarioSistema.findUnique({
      where: { id_usuario: decoded.userId },
      include: { rol: true }
    });

    if (!user) {
      return sendResponse(res, ApiResponse.unauthorized('Usuario no encontrado'));
    }

    const newToken = jwt.sign(
      { userId: user.id_usuario, username: user.username, role: user.rol.nombre },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as jwt.SignOptions
    );

    return sendResponse(res, ApiResponse.success({ token: newToken }));
  } catch (error) {
    return sendResponse(res, ApiResponse.unauthorized('Token de actualización inválido'));
  }
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return sendResponse(res, ApiResponse.unauthorized('No autorizado'));
    }

    const user = await prisma.usuarioSistema.findUnique({
      where: { id_usuario: userId },
      include: { rol: true, estado: true, congregacion: true }
    });

    if (!user) {
      return sendResponse(res, ApiResponse.notFound('Usuario no encontrado'));
    }

    return sendResponse(res, ApiResponse.success({
      id: user.id_usuario,
      username: user.username,
      email: user.email,
      nivel: user.nivel || user.rol.nombre,
      role: user.rol.nombre,
      id_congregacion: user.id_congregacion,
      congregacion: user.congregacion,
      estado: user.estado.nombre
    }));
  } catch (error) {
    console.error('Get user error:', error);
    return sendResponse(res, ApiResponse.error('Error al obtener usuario', error));
  }
});

export default router;