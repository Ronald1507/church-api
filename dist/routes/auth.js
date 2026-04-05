"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const estados_1 = require("../utils/estados");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
// Login
router.post('/login', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const loginIdentifier = email || username;
        if (!loginIdentifier || !password) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Email/Usuario y contraseña requeridos'));
        }
        const user = await db_1.default.usuarioSistema.findFirst({
            where: { OR: [{ email: loginIdentifier }, { username: loginIdentifier }] },
            include: { rol: true, estado: true, congregacion: true }
        });
        if (!user) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.unauthorized('Credenciales inválidas'));
        }
        const validPassword = await bcrypt_1.default.compare(password, user.password_hash);
        if (!validPassword) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.unauthorized('Credenciales inválidas'));
        }
        await db_1.default.usuarioSistema.update({
            where: { id_usuario: user.id_usuario },
            data: { ultimo_acceso: new Date() }
        });
        const token = jsonwebtoken_1.default.sign({ userId: user.id_usuario, username: user.username, nivel: user.nivel || 'USUARIO', id_congregacion: user.id_congregacion }, process.env.JWT_SECRET || 'secret', { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id_usuario }, process.env.JWT_REFRESH_SECRET || 'refresh-secret', { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success({ token, refreshToken, user: { id: user.id_usuario, username: user.username, email: user.email, nivel: user.nivel || 'USUARIO', id_congregacion: user.id_congregacion } }, 'Login exitoso'));
    }
    catch (error) {
        console.error('Login error:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error en el login', error));
    }
});
// Register
router.post('/register', async (req, res) => {
    try {
        const { username, password, email, id_rol, id_miembro } = req.body;
        if (!username || !password || !email) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Usuario, contraseña y email requeridos'));
        }
        const existingUser = await db_1.default.usuarioSistema.findFirst({
            where: { OR: [{ username }, { email }] }
        });
        if (existingUser) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Usuario o email ya existe'));
        }
        const role = await db_1.default.rolSistema.findUnique({ where: { id_rol: id_rol || 2 } });
        if (!role) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Rol inválido'));
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const roleId = id_rol || 2;
        const estadoActivo = await (0, estados_1.getEstadoByCodigo)('USUARIO', 'ACTIVO');
        if (!estadoActivo) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'ACTIVO' no encontrado"));
        }
        const newUser = await db_1.default.usuarioSistema.create({
            data: { username, password_hash: hashedPassword, email, id_rol: roleId, id_estado: estadoActivo.id_estado, id_miembro: id_miembro || null },
            include: { rol: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created({ id: newUser.id_usuario, username: newUser.username, email: newUser.email, role: newUser.rol.nombre }, 'Usuario registrado correctamente'));
    }
    catch (error) {
        console.error('Register error:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error en el registro', error));
    }
});
// Refresh token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Token de actualización requerido'));
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret');
        const user = await db_1.default.usuarioSistema.findUnique({
            where: { id_usuario: decoded.userId },
            include: { rol: true }
        });
        if (!user) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.unauthorized('Usuario no encontrado'));
        }
        const newToken = jsonwebtoken_1.default.sign({ userId: user.id_usuario, username: user.username, role: user.rol.nombre }, process.env.JWT_SECRET || 'secret', { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success({ token: newToken }));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.unauthorized('Token de actualización inválido'));
    }
});
// Get current user
router.get('/me', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.unauthorized('No autorizado'));
        }
        const user = await db_1.default.usuarioSistema.findUnique({
            where: { id_usuario: userId },
            include: { rol: true, estado: true, congregacion: true }
        });
        if (!user) {
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Usuario no encontrado'));
        }
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success({
            id: user.id_usuario,
            username: user.username,
            email: user.email,
            nivel: user.nivel || user.rol.nombre,
            role: user.rol.nombre,
            id_congregacion: user.id_congregacion,
            congregacion: user.congregacion,
            estado: user.estado.nombre
        }));
    }
    catch (error) {
        console.error('Get user error:', error);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener usuario', error));
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map