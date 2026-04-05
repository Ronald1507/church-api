"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const estados = await db_1.default.estado.findMany({ orderBy: [{ entidad: 'asc' }, { nombre: 'asc' }] });
        const grouped = estados.reduce((acc, estado) => {
            if (!acc[estado.entidad])
                acc[estado.entidad] = [];
            acc[estado.entidad].push({ id_estado: estado.id_estado, codigo: estado.codigo, nombre: estado.nombre, descripcion: estado.descripcion, es_estado_final: estado.es_estado_final });
            return acc;
        }, {});
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(grouped));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener estados', error));
    }
});
router.get('/:entidad', auth_1.authenticateToken, async (req, res) => {
    try {
        const { entidad } = req.params;
        if (Array.isArray(entidad))
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Parámetro inválido'));
        const estados = await db_1.default.estado.findMany({ where: { entidad: entidad.toUpperCase() }, orderBy: { nombre: 'asc' } });
        if (estados.length === 0)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound(`No hay estados para la entidad: ${entidad}`));
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(estados));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener estados', error));
    }
});
exports.default = router;
//# sourceMappingURL=estados.js.map