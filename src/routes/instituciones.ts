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

// Get all instituciones - filtrado por congregación
router.get('/', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const instituciones = await prisma.institucion.findMany({
      where: congregacionFilter,
      include: {
        congregacion: true,
        estado: true
      },
      orderBy: { nombre: 'asc' }
    });
    res.json(instituciones);
  } catch (error) {
    console.error('Error getting instituciones:', error);
    res.status(500).json({ error: 'Error al obtener instituciones' });
  }
});

// Get institucion by ID - filtrado por congregación
router.get('/:id', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const institucion = await prisma.institucion.findFirst({
      where: {
        id_institucion: id,
        ...congregacionFilter
      },
      include: {
        congregacion: true,
        estado: true,
        miembroInstitucions: {
          include: { miembro: true, estado: true }
        }
      }
    });

    if (!institucion) {
      return res.status(404).json({ error: 'Institución no encontrada' });
    }

    res.json(institucion);
  } catch (error) {
    console.error('Error getting institucion:', error);
    res.status(500).json({ error: 'Error al obtener institución' });
  }
});

// Create institucion
router.post('/', authenticateToken, requirePermission('instituciones', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, tipo, descripcion, id_congregacion, id_estado } = req.body;

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

    const newInstitucion = await prisma.institucion.create({
      data: {
        nombre,
        tipo,
        descripcion,
        id_congregacion: congregacionId,
        id_estado
      },
      include: {
        congregacion: true,
        estado: true
      }
    });

    res.status(201).json(newInstitucion);
  } catch (error) {
    console.error('Error creating institucion:', error);
    res.status(500).json({ error: 'Error al crear institución' });
  }
});

// Update institucion
router.put('/:id', authenticateToken, requirePermission('instituciones', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const congregacionFilter = getCongregacionFilter(req.user);
    
    // Verificar que la institucion pertenezca a la congregación del usuario
    const existingInstitucion = await prisma.institucion.findFirst({
      where: {
        id_institucion: id,
        ...congregacionFilter
      }
    });

    if (!existingInstitucion) {
      return res.status(404).json({ error: 'Institución no encontrada' });
    }
    
    const updateData = { ...req.body };
    delete updateData.id_institucion;
    delete updateData.created_at;
    delete updateData.updated_at;

    // Si no es admin, no permitir cambiar la congregación
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && updateData.id_congregacion) {
      delete updateData.id_congregacion;
    }

    const updatedInstitucion = await prisma.institucion.update({
      where: { id_institucion: id },
      data: updateData,
      include: {
        congregacion: true,
        estado: true
      }
    });

    res.json(updatedInstitucion);
  } catch (error) {
    console.error('Error updating institucion:', error);
    res.status(500).json({ error: 'Error al actualizar institución' });
  }
});

// Delete institucion
router.delete('/:id', authenticateToken, requirePermission('instituciones', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const congregacionFilter = getCongregacionFilter(req.user);
    
    // Verificar que la institucion pertenezca a la congregación del usuario
    const existingInstitucion = await prisma.institucion.findFirst({
      where: {
        id_institucion: id,
        ...congregacionFilter
      }
    });

    if (!existingInstitucion) {
      return res.status(404).json({ error: 'Institución no encontrada' });
    }
    
    await prisma.institucion.delete({
      where: { id_institucion: id }
    });

    res.json({ message: 'Institución eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting institucion:', error);
    res.status(500).json({ error: 'Error al eliminar institución' });
  }
});

// Get metadata for institucion form
router.get('/meta', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    let congregacionFilter = {};
    const { nivel } = req.user || {};
    
    // Si no es admin, solo puede ver su congregación
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) {
      congregacionFilter = { id_congregacion: req.user.id_congregacion };
    }

    const [estados, congregaciones] = await Promise.all([
      prisma.estado.findMany({
        where: { entidad: 'INSTITUCION' },
        orderBy: { nombre: 'asc' }
      }),
      prisma.congregacion.findMany({
        where: congregacionFilter,
        include: { estado: true },
        orderBy: { nombre: 'asc' }
      })
    ]);
    res.json({ estados, congregaciones });
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: 'Error al obtener metadatos' });
  }
});

export default router;