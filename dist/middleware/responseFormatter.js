"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withResponse = exports.responseFormatter = void 0;
const response_1 = require("./response");
// Guardar el método original json
const originalJson = Response.prototype.json;
/**
 * Middleware que intercepta todas las respuestas y las estandariza
 */
const responseFormatter = (req, res, next) => {
    // Sobrescribir el método json para formatear la respuesta
    res.json = function (data) {
        // Si ya es un objeto con la estructura de ApiResponse, dejar como está
        if (data !== null && typeof data === 'object' && 'success' in data && 'mensaje' in data) {
            return originalJson.call(this, data);
        }
        // Si la respuesta es un error (status >= 400), no formatear
        // Los errores ya se manejan en los catch blocks
        if (this.statusCode >= 400) {
            return originalJson.call(this, data);
        }
        // Formatear cualquier otra respuesta como éxito
        const formatted = response_1.ApiResponse.success(data, 'Operación exitosa', this.statusCode || 200);
        return originalJson.call(this, formatted);
    };
    next();
};
exports.responseFormatter = responseFormatter;
/**
 * Función helper para usar en los routes con try-catch
 * Envuelve el handler para formatear automáticamente las respuestas
 */
const withResponse = (handler) => {
    return async (req, res) => {
        try {
            await handler(req, res);
        }
        catch (error) {
            console.error('Error en handler:', error);
            // Determinar tipo de error
            const message = error instanceof Error ? error.message : 'Error desconocido';
            // Enviar respuesta de error formateada
            const response = response_1.ApiResponse.error('Error interno del servidor', message);
            return res.status(response.statusCode).json(response);
        }
    };
};
exports.withResponse = withResponse;
exports.default = exports.responseFormatter;
//# sourceMappingURL=responseFormatter.js.map