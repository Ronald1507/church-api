import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        userId: number;
        username: string;
        nivel: 'USUARIO' | 'ADMIN' | 'SUPERADMIN';
        id_congregacion: number | null;
    };
}
export declare const authenticateToken: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const requireRole: (...roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const requireCongregacion: (paramName?: string) => (req: AuthRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const getCongregacionFilter: (user: AuthRequest["user"]) => {
    id_congregacion?: undefined;
} | {
    id_congregacion: number;
};
export declare const filterByCongregacion: (keyName?: string) => (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map