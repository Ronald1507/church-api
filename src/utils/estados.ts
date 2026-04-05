import prisma from '../config/db';

/**
 * Utilidades para manejar estados dinámicamente desde la base de datos.
 * Busca estados por código - no usa arrays hardcodeados.
 * Los códigos se obtienen directamente de la tabla 'estado' en la DB.
 */

// Tipos de entidad - obtenidos de la columna 'entidad' en tabla Estado
export type EntidadEstado = 
  | 'MIEMBRO'
  | 'USUARIO'
  | 'CONGREGACION'
  | 'EVENTO'
  | 'TRANSACCION'
  | 'FINANZA_CUENTA'
  | 'INVENTARIO'
  | 'INSTITUCION'
  | 'VISITA_PASTORAL'
  | 'PETICION_ORACION'
  | 'CARGO_INSTITUCION'
  | 'MIEMBRO_INSTITUCION'
  | 'COMUNICACION'
  | 'DOCUMENTO'
  | 'PRESTAMO_INVENTARIO';

/**
 * Busca un estado por su código dentro de una entidad.
 * Ejemplo: getEstadoByCodigo('MIEMBRO', 'ACTIVO')
 */
export async function getEstadoByCodigo(
  entidad: EntidadEstado,
  codigo: string
): Promise<{ id_estado: number; nombre: string } | null> {
  return await prisma.estado.findFirst({
    where: { entidad, codigo },
    select: { id_estado: true, nombre: true }
  });
}

/**
 * Obtiene el ID de un estado por su código.
 * Lanza error si no se encuentra (validación estricta).
 */
export async function getEstadoId(
  entidad: EntidadEstado,
  codigo: string
): Promise<number> {
  const estado = await getEstadoByCodigo(entidad, codigo);
  if (!estado) {
    throw new Error(`Estado no encontrado: ${entidad}.${codigo}`);
  }
  return estado.id_estado;
}

/**
 * Obtiene todos los estados de una entidad.
 */
export async function getEstados(entidad: EntidadEstado) {
  return await prisma.estado.findMany({
    where: { entidad },
    orderBy: { nombre: 'asc' }
  });
}

/**
 * Obtiene todos los códigos disponibles para una entidad.
 * Útil para debugging y validación.
 */
export async function getCodigosDisponibles(entidad: EntidadEstado): Promise<string[]> {
  const estados = await prisma.estado.findMany({
    where: { entidad },
    select: { codigo: true },
    orderBy: { codigo: 'asc' }
  });
  return estados.map(e => e.codigo);
}
