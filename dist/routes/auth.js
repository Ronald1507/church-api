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
const router = (0, express_1.Router)();
// Login - acepta email o username
router.post('/login', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        // Aceptar email o username
        const loginIdentifier = email || username;
        if (!loginIdentifier || !password) {
            return res.status(400).json({ message: 'Email/Usuario y contraseña requeridos' });
        }
        // Buscar por email o username
        const user = await db_1.default.usuarioSistema.findFirst({
            where: {
                OR: [
                    { email: loginIdentifier },
                    { username: loginIdentifier }
                ]
            },
            include: { rol: true, estado: true, congregacion: true }
        });
        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }
        const validPassword = await bcrypt_1.default.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }
        // Update last access
        await db_1.default.usuarioSistema.update({
            where: { id_usuario: user.id_usuario },
            data: { ultimo_acceso: new Date() }
        });
        const token = jsonwebtoken_1.default.sign({
            userId: user.id_usuario,
            username: user.username,
            nivel: user.nivel || 'USUARIO',
            id_congregacion: user.id_congregacion
        }, process.env.JWT_SECRET || 'secret', { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id_usuario }, process.env.JWT_REFRESH_SECRET || 'refresh-secret', { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });
        res.json({
            token,
            refreshToken,
            user: {
                id: user.id_usuario,
                username: user.username,
                email: user.email,
                nivel: user.nivel || 'USUARIO',
                id_congregacion: user.id_congregacion
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error en el login' });
    }
});
// Register (solo para admins o primer usuario)
router.post('/register', async (req, res) => {
    try {
        const { username, password, email, id_rol, id_miembro } = req.body;
        if (!username || !password || !email) {
            return res.status(400).json({ error: 'Usuario, contraseña y email requeridos' });
        }
        // Check if user exists
        const existingUser = await db_1.default.usuarioSistema.findFirst({
            where: {
                OR: [{ username }, { email }]
            }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'Usuario o email ya existe' });
        }
        // Check if role exists
        const role = await db_1.default.rolSistema.findUnique({
            where: { id_rol: id_rol || 2 }
        });
        if (!role) {
            return res.status(400).json({ error: 'Rol inválido' });
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        // Default role: 2 (Usuario) if not specified
        const roleId = id_rol || 2;
        const newUser = await db_1.default.usuarioSistema.create({
            data: {
                username,
                password_hash: hashedPassword,
                email,
                id_rol: roleId,
                id_estado: 1, // Activo
                id_miembro: id_miembro || null
            },
            include: { rol: true }
        });
        res.status(201).json({
            id: newUser.id_usuario,
            username: newUser.username,
            email: newUser.email,
            role: newUser.rol.nombre
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Error en el registro' });
    }
});
// Refresh token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ message: 'Token de actualización requerido' });
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret');
        const user = await db_1.default.usuarioSistema.findUnique({
            where: { id_usuario: decoded.userId },
            include: { rol: true }
        });
        if (!user) {
            return res.status(401).json({ message: 'Usuario no encontrado' });
        }
        const newToken = jsonwebtoken_1.default.sign({
            userId: user.id_usuario,
            username: user.username,
            role: user.rol.nombre
        }, process.env.JWT_SECRET || 'secret', { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
        res.json({ token: newToken });
    }
    catch (error) {
        res.status(401).json({ message: 'Token de actualización inválido' });
    }
});
// Get current user - Protected route
router.get('/me', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'No autorizado' });
        }
        const user = await db_1.default.usuarioSistema.findUnique({
            where: { id_usuario: userId },
            include: {
                rol: true,
                estado: true,
                congregacion: true
            }
        });
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.json({
            id: user.id_usuario,
            username: user.username,
            email: user.email,
            nivel: user.nivel || user.rol.nombre,
            role: user.rol.nombre,
            id_congregacion: user.id_congregacion,
            congregacion: user.congregacion,
            estado: user.estado.nombre
        });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: 'Error al obtener usuario' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map