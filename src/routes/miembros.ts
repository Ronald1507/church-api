import { Router, Request, Response } from 'express';
import prisma from '../config/db';

const router = Router();

// Helper to get numeric ID from params
const getId = (req: Request): number | null => {
  const id = req.params.id;
  const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
  return isNaN(num) ? null : num;
};

// Get all members
router.get('/', async (req: Request, res: Response) => {
  try {
    const miembros = await prisma.miembro.findMany({
      include: {
        estado: true,
        congregacion: true,
        tipoMiembro: true,
        ministerio: true
      },
      orderBy: { apellidos: 'asc' }
    });
    res.json(miembros);
  } catch (error) {
    console.error('Get miembros error:', error);
    res.status(500).json({ error: 'Error al obtener miembros' });
  }
});

// Get member by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const memberId = getId(req);
    if (memberId === null) {
      return res.status(400).json({ error: 'ID de miembro inválido' });
    }
    
    const miembro = await prisma.miembro.findUnique({
      where: { id_miembro: memberId },
      include: {
        estado: true,
        congregacion: true,
        tipoMiembro: true,
        ministerio: true,
        cargoMinisterials: {
          include: { ministerio: true, estado: true }
        },
        relacionesOrigen: {
          include: { miembroDestino: true, tipoRelacion: true }
        },
        relacionesDestino: {
          include: { miembroOrigen: true, tipoRelacion: true }
        },
        historialEspirituals: {
          include: { tipoHito: true }
        },
        visitaPastorals: true,
        peticionOraciones: true,
        miembroInstitucions: {
          include: { institucion: true }
        },
        asistenciaEventos: {
          include: { evento: true }
        },
        documentos: true,
        ofrendaDizmos: true
      }
    });

    if (!miembro) {
      return res.status(404).json({ error: 'Miembro no encontrado' });
    }

    res.json(miembro);
  } catch (error) {
    console.error('Get miembro error:', error);
    res.status(500).json({ error: 'Error al obtener miembro' });
  }
});

// Create member
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      nombres,
      apellidos,
      fecha_nacimiento,
      genero,
      estado_civil,
      rut,
      telefono,
      email,
      direccion,
      foto_url,
      id_estado,
      id_congregacion,
      id_ministerio,
      id_tipo_miembro
    } = req.body;

    if (!nombres || !apellidos || !id_estado || !id_congregacion || !id_tipo_miembro) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const newMiembro = await prisma.miembro.create({
      data: {
        nombres,
        apellidos,
        fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : null,
        genero,
        estado_civil,
        rut,
        telefono,
        email,
        direccion,
        foto_url,
        id_estado,
        id_congregacion,
        id_ministerio,
        id_tipo_miembro
      },
      include: {
        estado: true,
        congregacion: true,
        tipoMiembro: true
      }
    });

    res.status(201).json(newMiembro);
  } catch (error) {
    console.error('Create miembro error:', error);
    res.status(500).json({ error: 'Error al crear miembro' });
  }
});

// Update member
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const memberId = getId(req);
    if (memberId === null) {
      return res.status(400).json({ error: 'ID de miembro inválido' });
    }
    
    const updateData = req.body;

    // Remove non-database fields
    delete updateData.id_miembro;
    delete updateData.created_at;
    delete updateData.updated_at;

    // Convert fecha_nacimiento if present
    if (updateData.fecha_nacimiento) {
      updateData.fecha_nacimiento = new Date(updateData.fecha_nacimiento);
    }

    const updatedMiembro = await prisma.miembro.update({
      where: { id_miembro: memberId },
      data: updateData,
      include: {
        estado: true,
        congregacion: true,
        tipoMiembro: true
      }
    });

    res.json(updatedMiembro);
  } catch (error) {
    console.error('Update miembro error:', error);
    res.status(500).json({ error: 'Error al actualizar miembro' });
  }
});

// Delete member
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const memberId = getId(req);
    if (memberId === null) {
      return res.status(400).json({ error: 'ID de miembro inválido' });
    }
    
    await prisma.miembro.delete({
      where: { id_miembro: memberId }
    });

    res.json({ message: 'Miembro eliminado correctamente' });
  } catch (error) {
    console.error('Delete miembro error:', error);
    res.status(500).json({ error: 'Error al eliminar miembro' });
  }
});

// Get member types
router.get('/meta/tipos', async (req: Request, res: Response) => {
  try {
    const tipos = await prisma.tipoMiembro.findMany({
      orderBy: { nombre: 'asc' }
    });
    res.json(tipos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tipos de miembro' });
  }
});

export default router;
