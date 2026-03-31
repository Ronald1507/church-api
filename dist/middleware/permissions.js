"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllowedTabs = exports.requirePermission = void 0;
const db_1 = __importDefault(require("../config/db"));
const requirePermission = (recurso, accion) => {
    return async (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }
        const { nivel, id_congregacion } = req.user;
        if (nivel === 'SUPERADMIN') {
            next();
            return;
        }
        if (nivel === 'ADMIN') {
            next();
            return;
        }
        if (nivel === 'USUARIO') {
            try {
                const usuario = await db_1.default.usuarioSistema.findUnique({
                    where: { id_usuario: req.user.userId },
                    include: {
                        rol: {
                            include: {
                                permisos: {
                                    include: {
                                        permiso: true
                                    }
                                }
                            }
                        }
                    }
                });
                if (!usuario || !usuario.rol) {
                    res.status(403).json({ error: 'Sin permisos asignados' });
                    return;
                }
                const hasPermission = usuario.rol.permisos.some((rp) => rp.permiso.recurso === recurso &&
                    (rp.permiso.accion === accion || rp.permiso.accion === 'admin'));
                if (!hasPermission) {
                    res.status(403).json({ error: `No tienes permiso para ${accion} ${recurso}` });
                    return;
                }
                next();
            }
            catch (error) {
                console.error('Permission check error:', error);
                res.status(500).json({ error: 'Error al verificar permisos' });
            }
            return;
        }
        res.status(403).json({ error: 'Nivel de acceso no reconocido' });
    };
};
exports.requirePermission = requirePermission;
const getAllowedTabs = (nivel) => {
    switch (nivel) {
        case 'SUPERADMIN':
            return ['dashboard', 'miembros', 'instituciones', 'finanzas', 'eventos', 'inventario', 'comunicaciones', 'usuarios', 'configuracion', 'reportes'];
        case 'ADMIN':
            return ['dashboard', 'miembros', 'instituciones', 'finanzas', 'eventos', 'inventario', 'comunicaciones', 'reportes'];
        case 'USUARIO':
            return ['dashboard', 'eventos', 'perfil'];
        default:
            return ['dashboard'];
    }
};
exports.getAllowedTabs = getAllowedTabs;
//# sourceMappingURL=permissions.js.map