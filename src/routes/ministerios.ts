import { Router, Request, Response } from 'express';
import prisma from '../config/db';

const router = Router();

// Helper to get numeric ID from params
const getId = (req: Request): number | null => {
  const id = req.params.id;
  const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
  return isNaN(num) ? null : num;
};

// Get all ministerios
router.get('/', async (req: Request, res: Response) => {
  try {
    const ministerios = await prisma.ministerio.findMany({
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

// Get ministerio by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const ministry = await prisma.ministerio.findUnique({
      where: { id_ministerio: id },
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

// Create ministerio
router.post('/', async (req: Request, res: Response) => {
  try {
    const { nombre, descripcion, id_lider, id_congregacion, id_estado } = req.body;

    if (!nombre || !id_congregacion || !id_estado) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const newMinisterio = await prisma.ministerio.create({
      data: {
        nombre,
        descripcion,
        id_lider,
        id_congregacion,
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

// Update ministerio
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const updateData = { ...req.body };
    delete updateData.id_ministerio;
    delete updateData.created_at;
    delete updateData.updated_at;

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

// Delete ministerio
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
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

export default router;
