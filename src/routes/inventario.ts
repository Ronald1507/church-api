import { Router, Request, Response } from 'express';
import prisma from '../config/db';

const router = Router();

// Helper to get numeric ID from params
const getId = (req: Request): number | null => {
  const id = req.params.id;
  const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
  return isNaN(num) ? null : num;
};

// ==================== ITEMS ====================

// Get all items
router.get('/', async (req: Request, res: Response) => {
  try {
    const items = await prisma.inventarioItem.findMany({
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

// Get item by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const item = await prisma.inventarioItem.findUnique({
      where: { id_item: id },
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const { nombre, categoria, descripcion, codigo, cantidad, unidad_medida, valor_unitario, ubicacion, id_congregacion, id_estado } = req.body;

    if (!nombre || !id_congregacion || !id_estado) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const newItem = await prisma.inventarioItem.create({
      data: {
        nombre,
        categoria,
        descripcion,
        codigo,
        cantidad: cantidad || 1,
        unidad_medida: unidad_medida || 'unidad',
        valor_unitario,
        ubicacion,
        id_congregacion,
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
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const updateData = { ...req.body };
    delete updateData.id_item;
    delete updateData.created_at;
    delete updateData.updated_at;

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

// Delete item
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    await prisma.inventarioItem.delete({
      where: { id_item: id }
    });

    res.json({ message: 'Item eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Error al eliminar item' });
  }
});

// ==================== MOVIMIENTOS ====================

// Get movimientos
router.get('/movimientos', async (req: Request, res: Response) => {
  try {
    const movimientos = await prisma.movimientoInventario.findMany({
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
router.post('/movimientos', async (req: Request, res: Response) => {
  try {
    const { id_item, tipo, cantidad, fecha, id_responsable, motivo } = req.body;

    if (!id_item || !tipo || !cantidad || !id_responsable) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Get current item
    const item = await prisma.inventarioItem.findUnique({
      where: { id_item }
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

    const [newMovimiento, updatedItem] = await prisma.$transaction([
      prisma.movimientoInventario.create({
        data: {
          id_item,
          tipo,
          cantidad,
          fecha: fecha ? new Date(fecha) : new Date(),
          id_responsable,
          motivo
        },
        include: { item: true }
      }),
      prisma.inventarioItem.update({
        where: { id_item },
        data: { cantidad: nuevaCantidad }
      })
    ]);

    res.status(201).json(newMovimiento);
  } catch (error) {
    console.error('Error creating movimiento:', error);
    res.status(500).json({ error: 'Error al crear movimiento' });
  }
});

// ==================== METADATA ====================

// Get metadata for inventory forms
router.get('/meta', async (req: Request, res: Response) => {
  try {
    const [estados, congregaciones] = await Promise.all([
      prisma.estado.findMany({
        where: { entidad: 'INVENTARIO' },
        orderBy: { nombre: 'asc' }
      }),
      prisma.congregacion.findMany({
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