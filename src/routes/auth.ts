import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Login - acepta email o username
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body;

    // Aceptar email o username
    const loginIdentifier = email || username;
    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: 'Email/Usuario y contraseña requeridos' });
    }

    // Buscar por email o username
    const user = await prisma.usuarioSistema.findFirst({
      where: {
        OR: [
          { email: loginIdentifier },
          { username: loginIdentifier }
        ]
      },
      include: { rol: true, estado: true, congregacion: true }
    });

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Update last access
    await prisma.usuarioSistema.update({
      where: { id_usuario: user.id_usuario },
      data: { ultimo_acceso: new Date() }
    });

    const token = jwt.sign(
      { 
        userId: user.id_usuario, 
        username: user.username, 
        nivel: user.nivel || 'USUARIO',
        id_congregacion: user.id_congregacion
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { userId: user.id_usuario },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id_usuario,
        username: user.username,
        email: user.email,
        nivel: user.nivel || 'USUARIO',
        id_congregacion: user.id_congregacion
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error en el login' });
  }
});

// Register (solo para admins o primer usuario)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, email, id_rol, id_miembro } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Usuario, contraseña y email requeridos' });
    }

    // Check if user exists
    const existingUser = await prisma.usuarioSistema.findFirst({
      where: {
        OR: [{ username }, { email }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Usuario o email ya existe' });
    }

    // Check if role exists
    const role = await prisma.rolSistema.findUnique({
      where: { id_rol: id_rol || 2 }
    });
    
    if (!role) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Default role: 2 (Usuario) if not specified
    const roleId = id_rol || 2;

    const newUser = await prisma.usuarioSistema.create({
      data: {
        username,
        password_hash: hashedPassword,
        email,
        id_rol: roleId,
        id_estado: 1, // Activo
        id_miembro: id_miembro || null
      },
      include: { rol: true }
    });

    res.status(201).json({
      id: newUser.id_usuario,
      username: newUser.username,
      email: newUser.email,
      role: newUser.rol.nombre
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Error en el registro' });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Token de actualización requerido' });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'refresh-secret'
    ) as { userId: number };

    const user = await prisma.usuarioSistema.findUnique({
      where: { id_usuario: decoded.userId },
      include: { rol: true }
    });

    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    const newToken = jwt.sign(
      { 
        userId: user.id_usuario, 
        username: user.username, 
        role: user.rol.nombre 
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as jwt.SignOptions
    );

    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ message: 'Token de actualización inválido' });
  }
});

// Get current user - Protected route
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const user = await prisma.usuarioSistema.findUnique({
      where: { id_usuario: userId },
      include: { 
        rol: true,
        estado: true,
        congregacion: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({
      id: user.id_usuario,
      username: user.username,
      email: user.email,
      role: user.rol.nombre,
      id_congregacion: user.id_congregacion,
      congregacion: user.congregacion,
      estado: user.estado.nombre
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
});

export default router;
