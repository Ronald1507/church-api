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

// Helper to get numeric ID from any param
const getNumericId = (param: string | string[]): number | null => {
  const value = Array.isArray(param) ? param[0] : param;
  const num = parseInt(value);
  return isNaN(num) ? null : num;
};

// Get metadata for evento form - MUST BE BEFORE /:id
router.get('/meta', authenticateToken, requirePermission('eventos', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    let congregacionFilter = {};
    const { nivel } = req.user || {};
    
    // Si no es admin, solo puede ver su congregación
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) {
      congregacionFilter = { id_congregacion: req.user.id_congregacion };
    }

    const [estados, congregaciones] = await Promise.all([
      prisma.estado.findMany({
        where: { entidad: 'EVENTO' },
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

// Get all eventos - filtrado por congregación
router.get('/', authenticateToken, requirePermission('eventos', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const eventos = await prisma.evento.findMany({
      where: congregacionFilter,
      include: {
        congregacion: true,
        estado: true
      },
      orderBy: { fecha_inicio: 'desc' }
    });
    res.json(eventos);
  } catch (error) {
    console.error('Error getting eventos:', error);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

// Get eventos by estado - dinámico
router.get('/estado/:idEstado', authenticateToken, requirePermission('eventos', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const idEstado = getNumericId(req.params.idEstado);
    if (idEstado === null) {
      return res.status(400).json({ error: 'ID de estado inválido' });
    }
    
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const eventos = await prisma.evento.findMany({
      where: {
        ...congregacionFilter,
        id_estado: idEstado
      },
      include: {
        congregacion: true,
        estado: true
      },
      orderBy: { fecha_inicio: 'desc' }
    });
    res.json(eventos);
  } catch (error) {
    console.error('Error getting eventos by estado:', error);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

// Get evento by ID - filtrado por congregación
router.get('/:id', authenticateToken, requirePermission('eventos', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const evento = await prisma.evento.findFirst({
      where: {
        id_evento: id,
        ...congregacionFilter
      },
      include: {
        congregacion: true,
        estado: true,
        asistencia: {
          include: { miembro: true }
        }
      }
    });

    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    res.json(evento);
  } catch (error) {
    console.error('Error getting evento:', error);
    res.status(500).json({ error: 'Error al obtener evento' });
  }
});

// Create evento
router.post('/', authenticateToken, requirePermission('eventos', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, tipo, descripcion, fecha_inicio, fecha_fin, lugar, id_congregacion, capacidad_max, id_estado } = req.body;

    if (!nombre || !fecha_inicio || !id_estado) {
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
      include: {
        congregacion: true,
        estado: true
      }
    });

    res.status(201).json(newEvento);
  } catch (error) {
    console.error('Error creating evento:', error);
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

// Update evento
router.put('/:id', authenticateToken, requirePermission('eventos', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const congregacionFilter = getCongregacionFilter(req.user);
    
    // Verificar que el evento pertenezca a la congregación del usuario
    const existingEvento = await prisma.evento.findFirst({
      where: {
        id_evento: id,
        ...congregacionFilter
      }
    });

    if (!existingEvento) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    
    const updateData = { ...req.body };
    delete updateData.id_evento;
    delete updateData.created_at;
    delete updateData.updated_at;

    // Convert dates
    if (updateData.fecha_inicio) {
      updateData.fecha_inicio = new Date(updateData.fecha_inicio);
    }
    if (updateData.fecha_fin) {
      updateData.fecha_fin = new Date(updateData.fecha_fin);
    }

    // Si no es admin, no permitir cambiar la congregación
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && updateData.id_congregacion) {
      delete updateData.id_congregacion;
    }

    const updatedEvento = await prisma.evento.update({
      where: { id_evento: id },
      data: updateData,
      include: {
        congregacion: true,
        estado: true
      }
    });

    res.json(updatedEvento);
  } catch (error) {
    console.error('Error updating evento:', error);
    res.status(500).json({ error: 'Error al actualizar evento' });
  }
});

// Delete evento (eliminación lógica)
router.delete('/:id', authenticateToken, requirePermission('eventos', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const congregacionFilter = getCongregacionFilter(req.user);
    
    // Verificar que el evento pertenezca a la congregación del usuario
    const existingEvento = await prisma.evento.findFirst({
      where: {
        id_evento: id,
        ...congregacionFilter
      }
    });

    if (!existingEvento) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    
    // Eliminación lógica: cambiar estado a Cancelado
    await prisma.evento.update({
      where: { id_evento: id },
      data: { id_estado: 11 } // ID de estado Cancelado para EVENTO
    });

    res.json({ message: 'Evento eliminado (cancelado)' });
  } catch (error) {
    console.error('Error deleting evento:', error);
    res.status(500).json({ error: 'Error al eliminar evento' });
  }
});

export default router;