import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
type Accion = 'crear' | 'leer' | 'actualizar' | 'eliminar' | 'admin';
export declare const requirePermission: (recurso: string, accion: Accion) => (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getAllowedTabs: (nivel: "USUARIO" | "ADMIN" | "SUPERADMIN") => string[];
export {};
//# sourceMappingURL=permissions.d.ts.map