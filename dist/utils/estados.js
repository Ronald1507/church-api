"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEstadoByCodigo = getEstadoByCodigo;
exports.getEstadoId = getEstadoId;
exports.getEstados = getEstados;
exports.getCodigosDisponibles = getCodigosDisponibles;
const db_1 = __importDefault(require("../config/db"));
/**
 * Busca un estado por su código dentro de una entidad.
 * Ejemplo: getEstadoByCodigo('MIEMBRO', 'ACTIVO')
 */
async function getEstadoByCodigo(entidad, codigo) {
    return await db_1.default.estado.findFirst({
        where: { entidad, codigo },
        select: { id_estado: true, nombre: true }
    });
}
/**
 * Obtiene el ID de un estado por su código.
 * Lanza error si no se encuentra (validación estricta).
 */
async function getEstadoId(entidad, codigo) {
    const estado = await getEstadoByCodigo(entidad, codigo);
    if (!estado) {
        throw new Error(`Estado no encontrado: ${entidad}.${codigo}`);
    }
    return estado.id_estado;
}
/**
 * Obtiene todos los estados de una entidad.
 */
async function getEstados(entidad) {
    return await db_1.default.estado.findMany({
        where: { entidad },
        orderBy: { nombre: 'asc' }
    });
}
/**
 * Obtiene todos los códigos disponibles para una entidad.
 * Útil para debugging y validación.
 */
async function getCodigosDisponibles(entidad) {
    const estados = await db_1.default.estado.findMany({
        where: { entidad },
        select: { codigo: true },
        orderBy: { codigo: 'asc' }
    });
    return estados.map(e => e.codigo);
}
//# sourceMappingURL=estados.js.map