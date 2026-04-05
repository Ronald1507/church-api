import { Router, Request, Response } from 'express';
import prisma from '../config/db';
import { authenticateToken, AuthRequest, getCongregacionFilter } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { getEstadoByCodigo } from '../utils/estados';

const router = Router();

// Helper to get numeric ID from params
const getId = (req: Request): number | null => {
  const id = req.params.id;
  const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
  return isNaN(num) ? null : num;
};

// Helper to get numeric ID from any param
const getNumericId = (param: string | string[]): number | null => {
  const value = Array.isArray(param) ? param[0] : param;
  const num = parseInt(value);
  return isNaN(num) ? null : num;
};

// Get options for congregacion form - MUST BE BEFORE /:id - Solo SuperAdmin
router.get('/opciones', authenticateToken, requirePermission('configuracion', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const estados = await prisma.estado.findMany({
      where: { entidad: 'CONGREGACION' },
      orderBy: { nombre: 'asc' }
    });
    res.json({ estados });
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: 'Error al obtener metadatos' });
  }
});

// Get all congregaciones - Solo SuperAdmin puede ver todas las congregaciones
// Los Admin ven su propia congregación
router.get('/', authenticateToken, requirePermission('configuracion', 'leer'), async (req: AuthRequest, res: Response) => {
  const { nivel, id_congregacion } = req.user || {};

  // Solo SuperAdmin puede ver todas las congregaciones
  if (nivel !== 'SUPERADMIN') {
    // Si es Admin y tiene congregación asignada, devolver solo esa
    if (nivel === 'ADMIN' && id_congregacion) {
      const congregacion = await prisma.congregacion.findUnique({
        where: { id_congregacion },
        include: { estado: true }
      });
      return res.json(congregacion ? [congregacion] : []);
    }
    return res.json([]);
  }

  try {
    const congregaciones = await prisma.congregacion.findMany({
      include: { estado: true },
      orderBy: { nombre: 'asc' }
    });
    res.json(congregaciones);
  } catch (error) {
    console.error('Error getting congregaciones:', error);
    res.status(500).json({ error: 'Error al obtener congregaciones' });
  }
});

// Get congregaciones by estado - valida que el estado pertenezca a CONGREGACION
router.get('/estado/:idEstado', authenticateToken, requirePermission('configuracion', 'leer'), async (req: AuthRequest, res: Response) => {
  const { nivel, id_congregacion } = req.user || {};
  
  const idEstado = getNumericId(req.params.idEstado);
  if (idEstado === null) {
    return res.status(400).json({ error: 'ID de estado inválido' });
  }

  // Validar que el estado pertenece a la entidad CONGREGACION
  const estado = await prisma.estado.findUnique({
    where: { id_estado: idEstado }
  });
  
  if (!estado) {
    return res.status(404).json({ error: 'Estado no encontrado' });
  }
  
  if (estado.entidad !== 'CONGREGACION') {
    return res.status(400).json({ error: `El estado ${idEstado} no pertenece a la entidad CONGREGACION` });
  }

  // Solo SuperAdmin puede ver todas las congregaciones
  if (nivel !== 'SUPERADMIN') {
    if (nivel === 'ADMIN' && id_congregacion) {
      const congregacion = await prisma.congregacion.findUnique({
        where: { id_congregacion, id_estado: idEstado },
        include: { estado: true }
      });
      return res.json(congregacion ? [congregacion] : []);
    }
    return res.json([]);
  }

  try {
    const congregaciones = await prisma.congregacion.findMany({
      where: { id_estado: idEstado },
      include: { estado: true },
      orderBy: { nombre: 'asc' }
    });
    res.json(congregaciones);
  } catch (error) {
    console.error('Error getting congregaciones by estado:', error);
    res.status(500).json({ error: 'Error al obtener congregaciones' });
  }
});

// Get congregacion by ID - Solo SuperAdmin puede ver cualquier congregación
router.get('/:id', authenticateToken, requirePermission('configuracion', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // Verificar acceso - SuperAdmin ve todo, Admin solo su congregación
    const { nivel, id_congregacion } = req.user || {};
    if (nivel !== 'SUPERADMIN' && (nivel !== 'ADMIN' || id_congregacion !== id)) {
      return res.status(403).json({ error: 'No tienes acceso a esta congregación' });
    }
    
    const congregacion = await prisma.congregacion.findUnique({
      where: { id_congregacion: id },
      include: {
        estado: true,
        miembros: true,
        institucions: true,
        eventos: true,
        finanzasCuentas: true,
        inventarioItems: true,
        presupuestos: true,
        comunicaciones: true
      }
    });

    if (!congregacion) {
      return res.status(404).json({ error: 'Congregación no encontrada' });
    }

    res.json(congregacion);
  } catch (error) {
    console.error('Error getting congregacion:', error);
    res.status(500).json({ error: 'Error al obtener congregación' });
  }
});

// Create congregacion - Solo SuperAdmin
router.post('/', authenticateToken, requirePermission('configuracion', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, direccion, ciudad, region, id_pastor, telefono, email, id_estado } = req.body;

    if (!nombre || !id_estado) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const newCongregacion = await prisma.congregacion.create({
      data: {
        nombre,
        direccion,
        ciudad,
        region,
        id_pastor: id_pastor ? parseInt(id_pastor) : null,
        telefono,
        email,
        id_estado
      },
      include: { estado: true }
    });

    res.status(201).json(newCongregacion);
  } catch (error) {
    console.error('Error creating congregacion:', error);
    res.status(500).json({ error: 'Error al crear congregación' });
  }
});

// Update congregacion - Solo SuperAdmin
router.put('/:id', authenticateToken, requirePermission('configuracion', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const updateData = { ...req.body };
    delete updateData.id_congregacion;
    delete updateData.created_at;
    delete updateData.updated_at;

    const updatedCongregacion = await prisma.congregacion.update({
      where: { id_congregacion: id },
      data: updateData,
      include: { estado: true }
    });

    res.json(updatedCongregacion);
  } catch (error) {
    console.error('Error updating congregacion:', error);
    res.status(500).json({ error: 'Error al actualizar congregación' });
  }
});

// Delete congregacion - Solo SuperAdmin (eliminación lógica)
router.delete('/:id', authenticateToken, requirePermission('configuracion', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    // Eliminación lógica: buscar estado por código
    const estadoInactiva = await getEstadoByCodigo('CONGREGACION', 'INACTIVA');
    if (!estadoInactiva) {
      return res.status(500).json({ error: "Estado 'INACTIVA' no encontrado en la base de datos" });
    }

    await prisma.congregacion.update({
      where: { id_congregacion: id },
      data: { id_estado: estadoInactiva.id_estado }
    });

    res.json({ message: 'Congregación eliminada (inactiva)' });
  } catch (error) {
    console.error('Error deleting congregacion:', error);
    res.status(500).json({ error: 'Error al eliminar congregación' });
  }
});

export default router;