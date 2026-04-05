/**
 * Utilidades para manejar estados dinámicamente desde la base de datos.
 * Busca estados por código - no usa arrays hardcodeados.
 * Los códigos se obtienen directamente de la tabla 'estado' en la DB.
 */
export type EntidadEstado = 'MIEMBRO' | 'USUARIO' | 'CONGREGACION' | 'EVENTO' | 'TRANSACCION' | 'FINANZA_CUENTA' | 'INVENTARIO' | 'INSTITUCION' | 'VISITA_PASTORAL' | 'PETICION_ORACION' | 'CARGO_INSTITUCION' | 'MIEMBRO_INSTITUCION' | 'COMUNICACION' | 'DOCUMENTO' | 'PRESTAMO_INVENTARIO';
/**
 * Busca un estado por su código dentro de una entidad.
 * Ejemplo: getEstadoByCodigo('MIEMBRO', 'ACTIVO')
 */
export declare function getEstadoByCodigo(entidad: EntidadEstado, codigo: string): Promise<{
    id_estado: number;
    nombre: string;
} | null>;
/**
 * Obtiene el ID de un estado por su código.
 * Lanza error si no se encuentra (validación estricta).
 */
export declare function getEstadoId(entidad: EntidadEstado, codigo: string): Promise<number>;
/**
 * Obtiene todos los estados de una entidad.
 */
export declare function getEstados(entidad: EntidadEstado): Promise<{
    id_estado: number;
    entidad: string;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    color_hex: string | null;
    es_estado_final: boolean;
    created_at: Date;
    updated_at: Date;
}[]>;
/**
 * Obtiene todos los códigos disponibles para una entidad.
 * Útil para debugging y validación.
 */
export declare function getCodigosDisponibles(entidad: EntidadEstado): Promise<string[]>;
//# sourceMappingURL=estados.d.ts.map