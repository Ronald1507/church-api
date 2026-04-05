import { Response } from 'express';
export interface ApiResponseType {
    success: boolean;
    mensaje: string;
    data?: unknown;
    error?: unknown;
    statusCode: number;
}
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
export declare class ApiResponse {
    /**
     * Respuesta exitosa (200, 201)
     */
    static success(data?: unknown, mensaje?: string, statusCode?: number): ApiResponseType;
    /**
     * Respuesta de creación (201)
     */
    static created(data: unknown, mensaje?: string): ApiResponseType;
    /**
     * Respuesta de actualización (200)
     */
    static updated(data: unknown, mensaje?: string): ApiResponseType;
    /**
     * Respuesta de eliminación (200)
     */
    static deleted(mensaje?: string): ApiResponseType;
    /**
     * Respuesta de error del servidor (500)
     */
    static error(mensaje?: string, errorDetails?: unknown): ApiResponseType;
    /**
     * Error de validación (400)
     */
    static validationError(mensaje?: string, errors?: unknown): ApiResponseType;
    /**
     * Recurso no encontrado (404)
     */
    static notFound(mensaje?: string): ApiResponseType;
    /**
     * Error de autenticación (401)
     */
    static unauthorized(mensaje?: string): ApiResponseType;
    /**
     * Error de permisos (403)
     */
    static forbidden(mensaje?: string): ApiResponseType;
}
/**
 * Middleware helper para enviar respuestas estandarizadas en Express
 */
export declare const sendResponse: (res: Response, response: ApiResponseType) => Response;
export default ApiResponse;
//# sourceMappingURL=response.d.ts.map