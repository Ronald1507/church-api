"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
/**
 * GET /api/estados
 * Retorna todos los estados disponibles en la base de datos,
 * agrupados por entidad.
 */
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const estados = await db_1.default.estado.findMany({
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
        }, {});
        res.json(grouped);
    }
    catch (error) {
        console.error('Get estados error:', error);
        res.status(500).json({ error: 'Error al obtener estados' });
    }
});
/**
 * GET /api/estados/:entidad
 * Retorna los estados de una entidad específica.
 */
router.get('/:entidad', auth_1.authenticateToken, async (req, res) => {
    try {
        const { entidad } = req.params;
        // Validar que entidad es un string
        if (Array.isArray(entidad)) {
            return res.status(400).json({ error: 'Parámetro inválido' });
        }
        const estados = await db_1.default.estado.findMany({
            where: { entidad: entidad.toUpperCase() },
            orderBy: { nombre: 'asc' }
        });
        if (estados.length === 0) {
            return res.status(404).json({ error: `No hay estados para la entidad: ${entidad}` });
        }
        res.json(estados);
    }
    catch (error) {
        console.error('Get estados by entidad error:', error);
        res.status(500).json({ error: 'Error al obtener estados' });
    }
});
exports.default = router;
//# sourceMappingURL=estados.js.map