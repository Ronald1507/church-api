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

// Get options for institucion form - MUST BE BEFORE /:id
router.get('/opciones', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
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
    
    // Tipos de institución hardcodeados
    const tiposInstitucion = [
      { id: 'CORO', nombre: 'Coro' },
      { id: 'JOVENES', nombre: 'Jóvenes' },
      { id: 'DORCAS', nombre: 'Dorcas' },
      { id: 'ESCUELA_DOMINICAL', nombre: 'Escuela Dominical' },
      { id: 'GUARDERIA', nombre: 'Guardería' },
      { id: 'OTRO', nombre: 'Otro' }
    ];
    
    res.json({ estados, congregaciones, tipos: tiposInstitucion });
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: 'Error al obtener metadatos' });
  }
});

// Get all instituciones - filtrado por congregación
router.get('/', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const instituciones = await prisma.institucion.findMany({
      where: {
        ...congregacionFilter
      },
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

// Get instituciones by estado - dinámico (ANTES de /:id)
router.get('/estado/:idEstado', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const idEstado = getNumericId(req.params.idEstado);
    if (idEstado === null) {
      return res.status(400).json({ error: 'ID de estado inválido' });
    }
    
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const instituciones = await prisma.institucion.findMany({
      where: {
        ...congregacionFilter,
        id_estado: idEstado
      },
      include: {
        congregacion: true,
        estado: true
      },
      orderBy: { nombre: 'asc' }
    });
    res.json(instituciones);
  } catch (error) {
    console.error('Error getting instituciones by estado:', error);
    res.status(500).json({ error: 'Error al obtener instituciones' });
  }
});

// Get institucion by ID - DEBE SER ÚLTIMO
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

// Delete institucion (eliminación lógica)
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
    
    // Eliminación lógica: cambiar estado a Inactiva (id_estado = 9)
    await prisma.institucion.update({
      where: { id_institucion: id },
      data: { id_estado: 9 }
    });
    
    res.json({ message: 'Institución eliminada (inactiva)' });
  } catch (error) {
    console.error('Error deleting institucion:', error);
    res.status(500).json({ error: 'Error al eliminar institución' });
  }
});

// ==================== CARGOS DE INSTITUCIÓN ====================

// Get members of an institucion with their roles
router.get('/:id/miembros', authenticateToken, requirePermission('instituciones', 'leer'), async (req: AuthRequest, res: Response) => {
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
      }
    });

    if (!institucion) {
      return res.status(404).json({ error: 'Institución no encontrada' });
    }

    const miembros = await prisma.miembroInstitucion.findMany({
      where: { id_institucion: id },
      include: {
        miembro: true,
        estado: true
      },
      orderBy: { fecha_ingreso: 'desc' }
    });

    // También obtener los cargos activos
    const cargos = await prisma.cargoInstitucion.findMany({
      where: { 
        id_institucion: id,
        fecha_fin: null
      },
      include: {
        miembro: true,
        estado: true
      }
    });

    res.json({ miembros, cargos });
  } catch (error) {
    console.error('Error getting miembros:', error);
    res.status(500).json({ error: 'Error al obtener miembros de la institución' });
  }
});

// Add member to institucion
router.post('/:id/miembros', authenticateToken, requirePermission('instituciones', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { id_miembro, rol } = req.body;

    if (!id_miembro) {
      return res.status(400).json({ error: 'ID de miembro requerido' });
    }

    const congregacionFilter = getCongregacionFilter(req.user);
    
    const institucion = await prisma.institucion.findFirst({
      where: {
        id_institucion: id,
        ...congregacionFilter
      }
    });

    if (!institucion) {
      return res.status(404).json({ error: 'Institución no encontrada' });
    }

    // Verificar que el miembro exista y pertenezca a la misma congregación
    const miembro = await prisma.miembro.findFirst({
      where: {
        id_miembro,
        ...congregacionFilter
      }
    });

    if (!miembro) {
      return res.status(404).json({ error: 'Miembro no encontrado en esta congregación' });
    }

    // Obtener estado activo para miembros de institución
    const estadoActivo = await prisma.estado.findFirst({
      where: { entidad: 'MIEMBRO', codigo: 'ACTIVO' }
    });

    const newRelacion = await prisma.miembroInstitucion.create({
      data: {
        id_miembro,
        id_institucion: id,
        rol: rol || 'MIEMBRO',
        id_estado: estadoActivo?.id_estado || 1,
        fecha_ingreso: new Date()
      },
      include: {
        miembro: true,
        institucion: true
      }
    });

    res.status(201).json(newRelacion);
  } catch (error) {
    console.error('Error adding miembro:', error);
    res.status(500).json({ error: 'Error al agregar miembro a la institución' });
  }
});

// Assign cargo to member in institucion
router.post('/:id/cargos', authenticateToken, requirePermission('instituciones', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { id_miembro, rol, fecha_inicio } = req.body;

    if (!id_miembro || !rol) {
      return res.status(400).json({ error: 'ID de miembro y rol requeridos' });
    }

    const congregacionFilter = getCongregacionFilter(req.user);
    
    const institucion = await prisma.institucion.findFirst({
      where: {
        id_institucion: id,
        ...congregacionFilter
      }
    });

    if (!institucion) {
      return res.status(404).json({ error: 'Institución no encontrada' });
    }

    // Verificar que el miembro esté relacionado con la institución
    const miembroInstitucion = await prisma.miembroInstitucion.findFirst({
      where: {
        id_miembro,
        id_institucion: id
      }
    });

    if (!miembroInstitucion) {
      return res.status(400).json({ error: 'El miembro no pertenece a esta institución' });
    }

    // Obtener estado activo para cargos
    const estadoActivo = await prisma.estado.findFirst({
      where: { entidad: 'MIEMBRO', codigo: 'ACTIVO' }
    });

    // Si el miembro ya tiene un cargo activo, cerrarlo
    await prisma.cargoInstitucion.updateMany({
      where: {
        id_miembro,
        id_institucion: id,
        fecha_fin: null
      },
      data: {
        fecha_fin: new Date()
      }
    });

    const newCargo = await prisma.cargoInstitucion.create({
      data: {
        id_miembro,
        id_institucion: id,
        rol,
        fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : new Date(),
        id_estado: estadoActivo?.id_estado || 1
      },
      include: {
        miembro: true,
        institucion: true
      }
    });

    res.status(201).json(newCargo);
  } catch (error) {
    console.error('Error assigning cargo:', error);
    res.status(500).json({ error: 'Error al asignar cargo en la institución' });
  }
});

// Remove member from institucion
router.delete('/:id/miembros/:idMiembro', authenticateToken, requirePermission('instituciones', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    const idMiembroParam = req.params.idMiembro;
    const idMiembro = typeof idMiembroParam === 'string' ? parseInt(idMiembroParam) : parseInt(Array.isArray(idMiembroParam) ? idMiembroParam[0] : '');
    
    if (id === null || isNaN(idMiembro)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const congregacionFilter = getCongregacionFilter(req.user);
    
    const institucion = await prisma.institucion.findFirst({
      where: {
        id_institucion: id,
        ...congregacionFilter
      }
    });

    if (!institucion) {
      return res.status(404).json({ error: 'Institución no encontrada' });
    }

    // Eliminar relación
    await prisma.miembroInstitucion.deleteMany({
      where: {
        id_miembro: idMiembro,
        id_institucion: id
      }
    });

    // Eliminar cargos del miembro en esta institución
    await prisma.cargoInstitucion.deleteMany({
      where: {
        id_miembro: idMiembro,
        id_institucion: id
      }
    });

    res.json({ message: 'Miembro removido de la institución correctamente' });
  } catch (error) {
    console.error('Error removing miembro:', error);
    res.status(500).json({ error: 'Error al remover miembro de la institución' });
  }
});

export default router;