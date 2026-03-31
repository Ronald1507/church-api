"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
const router = (0, express_1.Router)();
// Helper to get numeric ID from params
const getId = (req) => {
    const id = req.params.id;
    const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
    return isNaN(num) ? null : num;
};
// Get metadata for user form - MUST BE BEFORE /:id
router.get('/meta', auth_1.authenticateToken, (0, permissions_1.requirePermission)('usuarios', 'leer'), async (req, res) => {
    try {
        const [roles, estados, miembros, congregaciones] = await Promise.all([
            db_1.default.rolSistema.findMany({
                orderBy: { nombre: 'asc' }
            }),
            db_1.default.estado.findMany({
                where: { entidad: 'USUARIO' },
                orderBy: { nombre: 'asc' }
            }),
            db_1.default.miembro.findMany({
                where: { id_estado: 1 },
                orderBy: { nombres: 'asc' }
            }),
            db_1.default.congregacion.findMany({
                include: { estado: true },
                orderBy: { nombre: 'asc' }
            })
        ]);
        res.json({ roles, estados, miembros, congregaciones });
    }
    catch (error) {
        console.error('Get metadata error:', error);
        res.status(500).json({ error: 'Error al obtener metadatos' });
    }
});
// Get all users - SuperAdmin ve todos, Admin ve solo los de su congregación
router.get('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('usuarios', 'leer'), async (req, res) => {
    const { nivel, id_congregacion } = req.user || {};
    const where = nivel === 'SUPERADMIN'
        ? {}
        : { id_congregacion };
    try {
        const usuarios = await db_1.default.usuarioSistema.findMany({
            where,
            include: {
                rol: true,
                estado: true,
                congregacion: true,
                miembro: true
            },
            orderBy: { username: 'asc' }
        });
        res.json(usuarios);
    }
    catch (error) {
        console.error('Error getting usuarios:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});
// Get user by ID - Solo admin puede ver cualquier usuario
router.get('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('usuarios', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const usuario = await db_1.default.usuarioSistema.findUnique({
            where: { id_usuario: id },
            include: {
                rol: true,
                estado: true,
                congregacion: true,
                miembro: true
            }
        });
        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(usuario);
    }
    catch (error) {
        console.error('Error getting usuario:', error);
        res.status(500).json({ error: 'Error al obtener usuario' });
    }
});
// Create user - Solo admin
router.post('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('usuarios', 'crear'), async (req, res) => {
    try {
        const { username, email, password, id_rol, id_estado, id_congregacion, id_miembro } = req.body;
        if (!username || !email || !password || !id_rol || !id_estado) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
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
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const newUsuario = await db_1.default.usuarioSistema.create({
            data: {
                username,
                email,
                password_hash: hashedPassword,
                id_rol: parseInt(id_rol),
                id_estado: parseInt(id_estado),
                id_congregacion: id_congregacion ? parseInt(id_congregacion) : null,
                id_miembro: id_miembro ? parseInt(id_miembro) : null
            },
            include: {
                rol: true,
                estado: true,
                congregacion: true
            }
        });
        res.status(201).json(newUsuario);
    }
    catch (error) {
        console.error('Error creating usuario:', error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});
// Update user - Solo admin
router.put('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('usuarios', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const { password, ...updateData } = req.body;
        // Hash password if provided
        if (password) {
            updateData.password_hash = await bcrypt_1.default.hash(password, 10);
        }
        // Parse numeric fields
        if (updateData.id_rol)
            updateData.id_rol = parseInt(updateData.id_rol);
        if (updateData.id_estado)
            updateData.id_estado = parseInt(updateData.id_estado);
        if (updateData.id_congregacion)
            updateData.id_congregacion = parseInt(updateData.id_congregacion);
        if (updateData.id_miembro)
            updateData.id_miembro = parseInt(updateData.id_miembro);
        const updatedUsuario = await db_1.default.usuarioSistema.update({
            where: { id_usuario: id },
            data: updateData,
            include: {
                rol: true,
                estado: true,
                congregacion: true
            }
        });
        res.json(updatedUsuario);
    }
    catch (error) {
        console.error('Error updating usuario:', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});
// Delete user - Solo admin
router.delete('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('usuarios', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        // No permitir eliminar al propio usuario
        if (id === req.user?.userId) {
            return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
        }
        await db_1.default.usuarioSistema.delete({
            where: { id_usuario: id }
        });
        res.json({ message: 'Usuario eliminado correctamente' });
    }
    catch (error) {
        console.error('Error deleting usuario:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});
exports.default = router;
//# sourceMappingURL=usuarios.js.map