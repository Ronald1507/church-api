"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterByCongregacion = exports.getCongregacionFilter = exports.requireCongregacion = exports.requireRole = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
// middleware: authenticateToken - verificar token JWT
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
        const user = await db_1.default.usuarioSistema.findUnique({
            where: { id_usuario: decoded.userId },
            include: { rol: true }
        });
        if (!user) {
            return res.status(403).json({ error: 'Usuario no encontrado' });
        }
        const nivel = user.nivel || 'USUARIO';
        req.user = {
            userId: decoded.userId,
            username: decoded.username,
            nivel,
            id_congregacion: decoded.id_congregacion
        };
        next();
    }
    catch (error) {
        return res.status(403).json({ error: 'Token inválido o expirado' });
    }
};
exports.authenticateToken = authenticateToken;
// middleware: requireRole - verificar rol
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        if (req.user.nivel === 'SUPERADMIN' || req.user.nivel === 'ADMIN') {
            return next();
        }
        if (!roles.includes(req.user.nivel)) {
            return res.status(403).json({ error: 'Permisos insuficientes' });
        }
        next();
    };
};
exports.requireRole = requireRole;
// middleware: requireCongregacion - verificar acceso a congregación
// Si es admin, puede acceder a todas las congregaciones
// Si no es admin, solo puede acceder a su congregación
const requireCongregacion = (paramName = 'id_congregacion') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        // Admin y SuperAdmin pueden acceder a todo
        if (req.user.nivel === 'ADMIN' || req.user.nivel === 'SUPERADMIN') {
            return next();
        }
        // Verificar que el usuario tenga asignada una congregación
        if (!req.user.id_congregacion) {
            return res.status(403).json({ error: 'Usuario sin congregación asignada' });
        }
        // Obtener el ID de la congregación del request (por params o body)
        const congregacionId = req.params[paramName] || req.body[paramName];
        if (congregacionId) {
            const parsedId = parseInt(congregacionId);
            if (parsedId !== req.user.id_congregacion) {
                return res.status(403).json({ error: 'No tienes acceso a esta congregación' });
            }
        }
        next();
    };
};
exports.requireCongregacion = requireCongregacion;
// Función helper para obtener el filtro de congregación según el usuario
const getCongregacionFilter = (user) => {
    if (!user) {
        return {};
    }
    // Admin y SuperAdmin ven todas las congregaciones
    if (user.nivel === 'ADMIN' || user.nivel === 'SUPERADMIN') {
        return {};
    }
    // Otros usuarios solo ven su congregación
    if (user.id_congregacion) {
        return { id_congregacion: user.id_congregacion };
    }
    return { id_congregacion: -1 };
};
exports.getCongregacionFilter = getCongregacionFilter;
// Middleware para agregar filtro de congregación automáticamente
const filterByCongregacion = (keyName = 'id_congregacion') => {
    return (req, res, next) => {
        if (!req.user) {
            return next();
        }
        // Admin y SuperAdmin no necesitan filtro
        if (req.user.nivel === 'ADMIN' || req.user.nivel === 'SUPERADMIN') {
            return next();
        }
        // Agregar filtro al body si no existe o si existe pero es diferente
        if (!req.body[keyName]) {
            req.body[keyName] = req.user.id_congregacion;
        }
        next();
    };
};
exports.filterByCongregacion = filterByCongregacion;
//# sourceMappingURL=auth.js.map