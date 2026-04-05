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

export class ApiResponse {
  /**
   * Respuesta exitosa (200, 201)
   */
  static success(data: unknown = null, mensaje = 'Operación exitosa', statusCode = 200): ApiResponseType {
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
  static created(data: unknown, mensaje = 'Registro creado correctamente'): ApiResponseType {
    return ApiResponse.success(data, mensaje, 201);
  }

  /**
   * Respuesta de actualización (200)
   */
  static updated(data: unknown, mensaje = 'Registro actualizado correctamente'): ApiResponseType {
    return ApiResponse.success(data, mensaje, 200);
  }

  /**
   * Respuesta de eliminación (200)
   */
  static deleted(mensaje = 'Registro eliminado correctamente'): ApiResponseType {
    return ApiResponse.success(null, mensaje, 200);
  }

  /**
   * Respuesta de error del servidor (500)
   */
  static error(mensaje = 'Error interno del servidor', errorDetails: unknown = null): ApiResponseType {
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
  static validationError(mensaje = 'Datos inválidos', errors: unknown = null): ApiResponseType {
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
  static notFound(mensaje = 'Recurso no encontrado'): ApiResponseType {
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
  static unauthorized(mensaje = 'No autorizado'): ApiResponseType {
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
  static forbidden(mensaje = 'Acceso denegado'): ApiResponseType {
    return {
      success: false,
      mensaje,
      error: null,
      data: null,
      statusCode: 403
    };
  }
}

/**
 * Middleware helper para enviar respuestas estandarizadas en Express
 */
export const sendResponse = (res: Response, response: ApiResponseType): Response => {
  return res.status(response.statusCode).json({
    success: response.success,
    mensaje: response.mensaje,
    data: response.data,
    error: response.error || undefined
  });
};

export default ApiResponse;