import { Router, Request, Response } from 'express';
import prisma from '../config/db';
import bcrypt from 'bcrypt';

const router = Router();

// Helper to get numeric ID from params
const getId = (req: Request): number | null => {
  const id = req.params.id;
  const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
  return isNaN(num) ? null : num;
};

// Get all users
router.get('/', async (req: Request, res: Response) => {
  try {
    const usuarios = await prisma.usuarioSistema.findMany({
      include: {
        rol: true,
        estado: true,
        miembro: true
      },
      orderBy: { username: 'asc' }
    });
    res.json(usuarios);
  } catch (error) {
    console.error('Error getting usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Get user by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const usuario = await prisma.usuarioSistema.findUnique({
      where: { id_usuario: id },
      include: {
        rol: true,
        estado: true,
        miembro: true
      }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(usuario);
  } catch (error) {
    console.error('Error getting usuario:', error);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// Create user (admin only)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { username, email, password, id_rol, id_estado, id_miembro } = req.body;

    if (!username || !email || !password || !id_rol || !id_estado) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
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

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUsuario = await prisma.usuarioSistema.create({
      data: {
        username,
        email,
        password_hash: hashedPassword,
        id_rol,
        id_estado,
        id_miembro: id_miembro || null
      },
      include: {
        rol: true,
        estado: true
      }
    });

    res.status(201).json(newUsuario);
  } catch (error) {
    console.error('Error creating usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// Update user
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const { password, ...updateData } = req.body;

    // Hash password if provided
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    const updatedUsuario = await prisma.usuarioSistema.update({
      where: { id_usuario: id },
      data: updateData,
      include: {
        rol: true,
        estado: true
      }
    });

    res.json(updatedUsuario);
  } catch (error) {
    console.error('Error updating usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// Delete user
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    await prisma.usuarioSistema.delete({
      where: { id_usuario: id }
    });

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting usuario:', error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// Get metadata for user form
router.get('/meta', async (req: Request, res: Response) => {
  try {
    const [roles, estados, miembros] = await Promise.all([
      prisma.rolSistema.findMany({
        orderBy: { nombre: 'asc' }
      }),
      prisma.estado.findMany({
        where: { entidad: 'USUARIO' },
        orderBy: { nombre: 'asc' }
      }),
      prisma.miembro.findMany({
        where: { id_estado: 1 },
        orderBy: { nombres: 'asc' }
      })
    ]);
    res.json({ roles, estados, miembros });
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: 'Error al obtener metadatos' });
  }
});

export default router;