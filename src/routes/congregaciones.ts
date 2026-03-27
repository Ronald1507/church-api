import { Router, Request, Response } from 'express';
import prisma from '../config/db';

const router = Router();

// Helper to get numeric ID from params
const getId = (req: Request): number | null => {
  const id = req.params.id;
  const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
  return isNaN(num) ? null : num;
};

// Get all congregaciones
router.get('/', async (req: Request, res: Response) => {
  try {
    const congregaciones = await prisma.congregacion.findMany({
      include: {
        estado: true
      },
      orderBy: { nombre: 'asc' }
    });
    res.json(congregaciones);
  } catch (error) {
    console.error('Error getting congregaciones:', error);
    res.status(500).json({ error: 'Error al obtener congregaciones' });
  }
});

// Get congregacion by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const congregacion = await prisma.congregacion.findUnique({
      where: { id_congregacion: id },
      include: {
        estado: true,
        ministerios: true,
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

// Create congregacion
router.post('/', async (req: Request, res: Response) => {
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
        id_pastor,
        telefono,
        email,
        id_estado
      },
      include: {
        estado: true
      }
    });

    res.status(201).json(newCongregacion);
  } catch (error) {
    console.error('Error creating congregacion:', error);
    res.status(500).json({ error: 'Error al crear congregación' });
  }
});

// Update congregacion
router.put('/:id', async (req: Request, res: Response) => {
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
      include: {
        estado: true
      }
    });

    res.json(updatedCongregacion);
  } catch (error) {
    console.error('Error updating congregacion:', error);
    res.status(500).json({ error: 'Error al actualizar congregación' });
  }
});

// Delete congregacion
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = getId(req);
    if (id === null) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    await prisma.congregacion.delete({
      where: { id_congregacion: id }
    });

    res.json({ message: 'Congregación eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting congregacion:', error);
    res.status(500).json({ error: 'Error al eliminar congregación' });
  }
});

export default router;
