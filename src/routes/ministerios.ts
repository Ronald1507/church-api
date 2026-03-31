import { Router, Request, Response } from 'express';
import prisma from '../config/db';
import { authenticateToken, AuthRequest, getCongregacionFilter } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();

// Helper to get numeric ID from params
const getId = (req: Request): number | null => {
  const id = req.params.id;
  const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
  return isNaN(num) ? null : num;
};

// Get all ministerios - filtrado por congregación
router.get('/', authenticateToken, requirePermission('ministerios', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const ministerios = await prisma.ministerio.findMany({
      where: congregacionFilter,
      include: {
        congregacion: true,
        estado: true
      },
      orderBy: { nombre: 'asc' }
    });
    res.json(ministerios);
  } catch (error) {
    console.error('Error getting ministerios:', error);
    res.status(500).json({ error: 'Error al obtener ministerios' });
  }
});

// Get ministerio by ID - filtrado por congregación
router.get('/:id', authenticateToken, requirePermission('ministerios', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const ministry = await prisma.ministerio.findFirst({
      where: {
        id_ministerio: id,
        ...congregacionFilter
      },
      include: {
        congregacion: true,
        estado: true,
        miembros: true,
        cargos: {
          include: { miembro: true, estado: true }
        },
        comunicaciones: true,
        prestamos: {
          include: { item: true, estado: true }
        }
      }
    });

    if (!ministry) {
      return res.status(404).json({ error: 'Ministerio no encontrado' });
    }

    res.json(ministry);
  } catch (error) {
    console.error('Error getting ministry:', error);
    res.status(500).json({ error: 'Error al obtener ministerio' });
  }
});

// Create ministry
router.post('/', authenticateToken, requirePermission('ministerios', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, descripcion, id_lider, id_congregacion, id_estado } = req.body;

    if (!nombre || !id_estado) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Si no es admin, forzar la congregación del usuario
    let congregacionId = id_congregacion;
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) {
      congregacionId = req.user.id_congregacion;
    }

    if (!congregacionId) {
      return res.status(400).json({ error: 'Debe especificar una congregación' });
    }

    const newMinisterio = await prisma.ministerio.create({
      data: {
        nombre,
        descripcion,
        id_lider: id_lider ? parseInt(id_lider) : null,
        id_congregacion: congregacionId,
        id_estado
      },
      include: {
        congregacion: true,
        estado: true
      }
    });

    res.status(201).json(newMinisterio);
  } catch (error) {
    console.error('Error creating ministry:', error);
    res.status(500).json({ error: 'Error al crear ministerio' });
  }
});

// Update ministry
router.put('/:id', authenticateToken, requirePermission('ministerios', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const congregacionFilter = getCongregacionFilter(req.user);
    
    // Verificar que el ministerio pertenezca a la congregación del usuario
    const existingMinisterio = await prisma.ministerio.findFirst({
      where: {
        id_ministerio: id,
        ...congregacionFilter
      }
    });

    if (!existingMinisterio) {
      return res.status(404).json({ error: 'Ministerio no encontrado' });
    }
    
    const updateData = { ...req.body };
    delete updateData.id_ministerio;
    delete updateData.created_at;
    delete updateData.updated_at;

    // Si no es admin, no permitir cambiar la congregación
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && updateData.id_congregacion) {
      delete updateData.id_congregacion;
    }

    const updatedMinisterio = await prisma.ministerio.update({
      where: { id_ministerio: id },
      data: updateData,
      include: {
        congregacion: true,
        estado: true
      }
    });

    res.json(updatedMinisterio);
  } catch (error) {
    console.error('Error updating ministry:', error);
    res.status(500).json({ error: 'Error al actualizar ministerio' });
  }
});

// Delete ministry
router.delete('/:id', authenticateToken, requirePermission('ministerios', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const congregacionFilter = getCongregacionFilter(req.user);
    
    // Verificar que el ministerio pertenezca a la congregación del usuario
    const existingMinisterio = await prisma.ministerio.findFirst({
      where: {
        id_ministerio: id,
        ...congregacionFilter
      }
    });

    if (!existingMinisterio) {
      return res.status(404).json({ error: 'Ministerio no encontrado' });
    }
    
    await prisma.ministerio.delete({
      where: { id_ministerio: id }
    });

    res.json({ message: 'Ministerio eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting ministry:', error);
    res.status(500).json({ error: 'Error al eliminar ministerio' });
  }
});

// Get metadata for ministry form
router.get('/meta', authenticateToken, requirePermission('ministerios', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    let congregacionFilter = {};
    const { nivel } = req.user || {};
    
    // Si no es admin, solo puede ver su congregación
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) {
      congregacionFilter = { id_congregacion: req.user.id_congregacion };
    }

    const [estados, congregaciones, miembros] = await Promise.all([
      prisma.estado.findMany({
        where: { entidad: 'MINISTERIO' },
        orderBy: { nombre: 'asc' }
      }),
      prisma.congregacion.findMany({
        where: congregacionFilter,
        include: { estado: true },
        orderBy: { nombre: 'asc' }
      }),
      prisma.miembro.findMany({
        where: { 
          id_estado: 1, // Solo activos
          ...congregacionFilter
        },
        orderBy: { nombres: 'asc' }
      })
    ]);
    res.json({ estados, congregaciones, miembros });
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: 'Error al obtener metadatos' });
  }
});

export default router;