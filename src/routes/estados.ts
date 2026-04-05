import { Router, Request, Response } from 'express';
import prisma from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { ApiResponse, sendResponse } from '../utils/response';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const estados = await prisma.estado.findMany({ orderBy: [{ entidad: 'asc' }, { nombre: 'asc' }] });
    const grouped = estados.reduce((acc, estado) => {
      if (!acc[estado.entidad]) acc[estado.entidad] = [];
      acc[estado.entidad].push({ id_estado: estado.id_estado, codigo: estado.codigo, nombre: estado.nombre, descripcion: estado.descripcion, es_estado_final: estado.es_estado_final });
      return acc;
    }, {} as Record<string, Array<{ id_estado: number; codigo: string; nombre: string; descripcion: string | null; es_estado_final: boolean }>>);
    return sendResponse(res, ApiResponse.success(grouped));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener estados', error));
  }
});

router.get('/:entidad', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { entidad } = req.params;
    if (Array.isArray(entidad)) return sendResponse(res, ApiResponse.validationError('Parámetro inválido'));
    const estados = await prisma.estado.findMany({ where: { entidad: entidad.toUpperCase() }, orderBy: { nombre: 'asc' } });
    if (estados.length === 0) return sendResponse(res, ApiResponse.notFound(`No hay estados para la entidad: ${entidad}`));
    return sendResponse(res, ApiResponse.success(estados));
  } catch (error) {
    return sendResponse(res, ApiResponse.error('Error al obtener estados', error));
  }
});

export default router;