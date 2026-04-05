import { Request, Response, NextFunction } from 'express';
/**
 * Middleware que intercepta todas las respuestas y las estandariza
 */
export declare const responseFormatter: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Función helper para usar en los routes con try-catch
 * Envuelve el handler para formatear automáticamente las respuestas
 */
export declare const withResponse: (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response) => Promise<void>;
export default responseFormatter;
//# sourceMappingURL=responseFormatter.d.ts.map