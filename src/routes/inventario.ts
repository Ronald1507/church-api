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

// ==================== OPCIONES - MUST BE BEFORE /:id ====================

// Get options for inventory forms
router.get('/opciones', authenticateToken, requirePermission('inventario', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    let congregacionFilter = {};
    const { nivel } = req.user || {};
    
    // Si no es admin, solo puede ver su congregación
    if (nivel !== 'ADMIN' && req.user?.id_congregacion) {
      congregacionFilter = { id_congregacion: req.user.id_congregacion };
    }

    const [estados, congregaciones] = await Promise.all([
      prisma.estado.findMany({
        where: { entidad: 'INVENTARIO' },
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

// ==================== ITEMS ====================

// Get all items - filtrado por congregación
router.get('/', authenticateToken, requirePermission('inventario', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const items = await prisma.inventarioItem.findMany({
      where: congregacionFilter,
      include: {
        congregacion: true,
        estado: true
      },
      orderBy: { nombre: 'asc' }
    });
    res.json(items);
  } catch (error) {
    console.error('Error getting items:', error);
    res.status(500).json({ error: 'Error al obtener items' });
  }
});

// Get items by estado - dinámico
router.get('/estado/:idEstado', authenticateToken, requirePermission('inventario', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const idEstado = getNumericId(req.params.idEstado);
    if (idEstado === null) {
      return res.status(400).json({ error: 'ID de estado inválido' });
    }
    
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const items = await prisma.inventarioItem.findMany({
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
    res.json(items);
  } catch (error) {
    console.error('Error getting items by estado:', error);
    res.status(500).json({ error: 'Error al obtener items' });
  }
});

// Get item by ID - filtrado por congregación
router.get('/:id', authenticateToken, requirePermission('inventario', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const item = await prisma.inventarioItem.findFirst({
      where: {
        id_item: id,
        ...congregacionFilter
      },
      include: {
        congregacion: true,
        estado: true,
        movimientos: {
          orderBy: { fecha: 'desc' },
          take: 20
        },
        prestamos: {
          include: { ministerios: true, estado: true }
        }
      }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    res.json(item);
  } catch (error) {
    console.error('Error getting item:', error);
    res.status(500).json({ error: 'Error al obtener item' });
  }
});

// Create item
router.post('/', authenticateToken, requirePermission('inventario', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, categoria, descripcion, codigo, cantidad, unidad_medida, valor_unitario, ubicacion, id_congregacion, id_estado } = req.body;

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

    const newItem = await prisma.inventarioItem.create({
      data: {
        nombre,
        categoria,
        descripcion,
        codigo,
        cantidad: cantidad || 1,
        unidad_medida: unidad_medida || 'unidad',
        valor_unitario: valor_unitario ? parseFloat(valor_unitario) : null,
        ubicacion,
        id_congregacion: congregacionId,
        id_estado
      },
      include: {
        congregacion: true,
        estado: true
      }
    });

    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Error al crear item' });
  }
});

// Update item
router.put('/:id', authenticateToken, requirePermission('inventario', 'actualizar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const congregacionFilter = getCongregacionFilter(req.user);
    
    // Verificar que el item pertenezca a la congregación del usuario
    const existingItem = await prisma.inventarioItem.findFirst({
      where: {
        id_item: id,
        ...congregacionFilter
      }
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    
    const updateData = { ...req.body };
    delete updateData.id_item;
    delete updateData.created_at;
    delete updateData.updated_at;

    // Si no es admin, no permitir cambiar la congregación
    const { nivel } = req.user || {};
    if (nivel !== 'ADMIN' && updateData.id_congregacion) {
      delete updateData.id_congregacion;
    }

    const updatedItem = await prisma.inventarioItem.update({
      where: { id_item: id },
      data: updateData,
      include: {
        congregacion: true,
        estado: true
      }
    });

    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Error al actualizar item' });
  }
});

// Delete item (eliminación lógica)
router.delete('/:id', authenticateToken, requirePermission('inventario', 'eliminar'), async (req: AuthRequest, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const congregacionFilter = getCongregacionFilter(req.user);
    
    // Verificar que el item pertenezca a la congregación del usuario
    const existingItem = await prisma.inventarioItem.findFirst({
      where: {
        id_item: id,
        ...congregacionFilter
      }
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    
    // Eliminación lógica: cambiar estado a Descontinuado
    await prisma.inventarioItem.update({
      where: { id_item: id },
      data: { id_estado: 17 } // ID de estado Descontinuado para INVENTARIO
    });

    res.json({ message: 'Item eliminado (descontinuado)' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Error al eliminar item' });
  }
});

// ==================== MOVIMIENTOS ====================

// Get movimientos - filtrado por congregación
router.get('/movimientos', authenticateToken, requirePermission('inventario', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const congregacionFilter = getCongregacionFilter(req.user);
    
    const movimientos = await prisma.movimientoInventario.findMany({
      where: {
        item: congregacionFilter
      },
      include: {
        item: true
      },
      orderBy: { fecha: 'desc' }
    });
    res.json(movimientos);
  } catch (error) {
    console.error('Error getting movimientos:', error);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});

// Create movimiento
router.post('/movimientos', authenticateToken, requirePermission('inventario', 'crear'), async (req: AuthRequest, res: Response) => {
  try {
    const { id_item, tipo, cantidad, fecha, id_responsable, motivo } = req.body;

    if (!id_item || !tipo || !cantidad || !id_responsable) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Verificar que el item pertenezca a la congregación del usuario
    const congregacionFilter = getCongregacionFilter(req.user);
    const item = await prisma.inventarioItem.findFirst({
      where: {
        id_item: parseInt(id_item),
        ...congregacionFilter
      }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    // Update item quantity
    const nuevaCantidad = tipo === 'entrada' 
      ? item.cantidad + cantidad 
      : item.cantidad - cantidad;

    if (nuevaCantidad < 0) {
      return res.status(400).json({ error: 'No hay suficiente stock' });
    }

    const [newMovimiento] = await prisma.$transaction([
      prisma.movimientoInventario.create({
        data: {
          id_item: parseInt(id_item),
          tipo,
          cantidad,
          fecha: fecha ? new Date(fecha) : new Date(),
          id_responsable: parseInt(id_responsable),
          motivo
        },
        include: { item: true }
      }),
      prisma.inventarioItem.update({
        where: { id_item: parseInt(id_item) },
        data: { cantidad: nuevaCantidad }
      })
    ]);

    res.status(201).json(newMovimiento);
  } catch (error) {
    console.error('Error creating movimiento:', error);
    res.status(500).json({ error: 'Error al crear movimiento' });
  }
});

export default router;