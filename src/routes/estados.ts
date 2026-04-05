import { Router, Request, Response } from 'express';
import prisma from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/estados
 * Retorna todos los estados disponibles en la base de datos,
 * agrupados por entidad.
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const estados = await prisma.estado.findMany({
      orderBy: [
        { entidad: 'asc' },
        { nombre: 'asc' }
      ]
    });

    // Agrupar por entidad
    const grouped = estados.reduce((acc, estado) => {
      if (!acc[estado.entidad]) {
        acc[estado.entidad] = [];
      }
      acc[estado.entidad].push({
        id_estado: estado.id_estado,
        codigo: estado.codigo,
        nombre: estado.nombre,
        descripcion: estado.descripcion,
        es_estado_final: estado.es_estado_final
      });
      return acc;
    }, {} as Record<string, Array<{
      id_estado: number;
      codigo: string;
      nombre: string;
      descripcion: string | null;
      es_estado_final: boolean;
    }>>);

    res.json(grouped);
  } catch (error) {
    console.error('Get estados error:', error);
    res.status(500).json({ error: 'Error al obtener estados' });
  }
});

/**
 * GET /api/estados/:entidad
 * Retorna los estados de una entidad específica.
 */
router.get('/:entidad', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { entidad } = req.params;
    
    // Validar que entidad es un string
    if (Array.isArray(entidad)) {
      return res.status(400).json({ error: 'Parámetro inválido' });
    }
    
    const estados = await prisma.estado.findMany({
      where: { entidad: entidad.toUpperCase() },
      orderBy: { nombre: 'asc' }
    });

    if (estados.length === 0) {
      return res.status(404).json({ error: `No hay estados para la entidad: ${entidad}` });
    }

    res.json(estados);
  } catch (error) {
    console.error('Get estados by entidad error:', error);
    res.status(500).json({ error: 'Error al obtener estados' });
  }
});

export default router;
