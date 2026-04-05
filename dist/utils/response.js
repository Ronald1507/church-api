"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendResponse = exports.ApiResponse = void 0;
/**
 * Helper para respuestas API estandarizadas
 *
 * Estructura de respuesta:
 * {
 *   success: boolean,
 *   mensaje: string,
 *   data?: any,
 *   error?: string
 * }
 */
class ApiResponse {
    /**
     * Respuesta exitosa (200, 201)
     */
    static success(data = null, mensaje = 'Operación exitosa', statusCode = 200) {
        return {
            success: true,
            mensaje,
            data,
            statusCode
        };
    }
    /**
     * Respuesta de creación (201)
     */
    static created(data, mensaje = 'Registro creado correctamente') {
        return ApiResponse.success(data, mensaje, 201);
    }
    /**
     * Respuesta de actualización (200)
     */
    static updated(data, mensaje = 'Registro actualizado correctamente') {
        return ApiResponse.success(data, mensaje, 200);
    }
    /**
     * Respuesta de eliminación (200)
     */
    static deleted(mensaje = 'Registro eliminado correctamente') {
        return ApiResponse.success(null, mensaje, 200);
    }
    /**
     * Respuesta de error del servidor (500)
     */
    static error(mensaje = 'Error interno del servidor', errorDetails = null) {
        return {
            success: false,
            mensaje,
            error: errorDetails,
            data: null,
            statusCode: 500
        };
    }
    /**
     * Error de validación (400)
     */
    static validationError(mensaje = 'Datos inválidos', errors = null) {
        return {
            success: false,
            mensaje,
            error: errors,
            data: null,
            statusCode: 400
        };
    }
    /**
     * Recurso no encontrado (404)
     */
    static notFound(mensaje = 'Recurso no encontrado') {
        return {
            success: false,
            mensaje,
            error: null,
            data: null,
            statusCode: 404
        };
    }
    /**
     * Error de autenticación (401)
     */
    static unauthorized(mensaje = 'No autorizado') {
        return {
            success: false,
            mensaje,
            error: null,
            data: null,
            statusCode: 401
        };
    }
    /**
     * Error de permisos (403)
     */
    static forbidden(mensaje = 'Acceso denegado') {
        return {
            success: false,
            mensaje,
            error: null,
            data: null,
            statusCode: 403
        };
    }
}
exports.ApiResponse = ApiResponse;
/**
 * Middleware helper para enviar respuestas estandarizadas en Express
 */
const sendResponse = (res, response) => {
    return res.status(response.statusCode).json({
        success: response.success,
        mensaje: response.mensaje,
        data: response.data,
        error: response.error || undefined
    });
};
exports.sendResponse = sendResponse;
exports.default = ApiResponse;
//# sourceMappingURL=response.js.map