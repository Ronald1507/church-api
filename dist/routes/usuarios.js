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
const estados_1 = require("../utils/estados");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
const getId = (req) => {
    const id = req.params.id;
    const num = typeof id === 'string' ? parseInt(id) : parseInt(id?.[0] || '');
    return isNaN(num) ? null : num;
};
const getNumericId = (param) => {
    const value = Array.isArray(param) ? param[0] : param;
    const num = parseInt(value);
    return isNaN(num) ? null : num;
};
// Opciones
router.get('/opciones', auth_1.authenticateToken, (0, permissions_1.requirePermission)('usuarios', 'leer'), async (req, res) => {
    try {
        const estadoActivo = await (0, estados_1.getEstadoByCodigo)('MIEMBRO', 'ACTIVO');
        const miembroFilter = estadoActivo ? { id_estado: estadoActivo.id_estado } : {};
        const [roles, estados, miembros, congregaciones] = await Promise.all([
            db_1.default.rolSistema.findMany({ orderBy: { nombre: 'asc' } }),
            db_1.default.estado.findMany({ where: { entidad: 'USUARIO' }, orderBy: { nombre: 'asc' } }),
            db_1.default.miembro.findMany({ where: miembroFilter, orderBy: { nombres: 'asc' } }),
            db_1.default.congregacion.findMany({ include: { estado: true }, orderBy: { nombre: 'asc' } })
        ]);
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success({ roles, estados, miembros, congregaciones }));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener metadatos', error));
    }
});
// Get all users
router.get('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('usuarios', 'leer'), async (req, res) => {
    const { nivel, id_congregacion } = req.user || {};
    const where = nivel === 'SUPERADMIN' ? {} : { id_congregacion: id_congregacion || undefined };
    if (nivel === 'ADMIN' && !id_congregacion)
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success([]));
    try {
        const usuarios = await db_1.default.usuarioSistema.findMany({ where, include: { rol: true, estado: true, congregacion: true }, orderBy: { username: 'asc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(usuarios));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener usuarios', error));
    }
});
// Get users by estado
router.get('/estado/:idEstado', auth_1.authenticateToken, (0, permissions_1.requirePermission)('usuarios', 'leer'), async (req, res) => {
    const { nivel, id_congregacion } = req.user || {};
    const idEstado = getNumericId(req.params.idEstado);
    if (idEstado === null)
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID de estado inválido'));
    const estado = await db_1.default.estado.findUnique({ where: { id_estado: idEstado } });
    if (!estado)
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Estado no encontrado'));
    if (estado.entidad !== 'USUARIO')
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('El estado no pertenece a USUARIO'));
    if (nivel === 'ADMIN' && !id_congregacion)
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success([]));
    const usersWhere = nivel === 'SUPERADMIN' ? { id_estado: idEstado } : { id_congregacion: id_congregacion || undefined, id_estado: idEstado };
    try {
        const usuarios = await db_1.default.usuarioSistema.findMany({ where: usersWhere, include: { rol: true, estado: true, congregacion: true }, orderBy: { username: 'asc' } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(usuarios));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener usuarios', error));
    }
});
// Get user by ID
router.get('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('usuarios', 'leer'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const usuario = await db_1.default.usuarioSistema.findUnique({ where: { id_usuario: id }, include: { rol: true, estado: true, congregacion: true } });
        if (!usuario)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.notFound('Usuario no encontrado'));
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.success(usuario));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al obtener usuario', error));
    }
});
// Create user
router.post('/', auth_1.authenticateToken, (0, permissions_1.requirePermission)('usuarios', 'crear'), async (req, res) => {
    try {
        const { username, email, password, id_rol, id_estado, id_congregacion, id_miembro } = req.body;
        if (!username || !email || !password || !id_rol || !id_estado)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Faltan campos requeridos'));
        const existingUser = await db_1.default.usuarioSistema.findFirst({ where: { OR: [{ username }, { email }] } });
        if (existingUser)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('Usuario o email ya existe'));
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const newUsuario = await db_1.default.usuarioSistema.create({
            data: { username, email, password_hash: hashedPassword, id_rol: parseInt(id_rol), id_estado: parseInt(id_estado), id_congregacion: id_congregacion ? parseInt(id_congregacion) : null, id_miembro: id_miembro ? parseInt(id_miembro) : null },
            include: { rol: true, estado: true, congregacion: true }
        });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.created(newUsuario, 'Usuario creado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al crear usuario', error));
    }
});
// Update user
router.put('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('usuarios', 'actualizar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        const { password, ...updateData } = req.body;
        if (password)
            updateData.password_hash = await bcrypt_1.default.hash(password, 10);
        if (updateData.id_rol)
            updateData.id_rol = parseInt(updateData.id_rol);
        if (updateData.id_estado)
            updateData.id_estado = parseInt(updateData.id_estado);
        if (updateData.id_congregacion)
            updateData.id_congregacion = parseInt(updateData.id_congregacion);
        if (updateData.id_miembro)
            updateData.id_miembro = parseInt(updateData.id_miembro);
        const updatedUsuario = await db_1.default.usuarioSistema.update({ where: { id_usuario: id }, data: updateData, include: { rol: true, estado: true, congregacion: true } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.updated(updatedUsuario, 'Usuario actualizado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al actualizar usuario', error));
    }
});
// Delete user
router.delete('/:id', auth_1.authenticateToken, (0, permissions_1.requirePermission)('usuarios', 'eliminar'), async (req, res) => {
    try {
        const id = getId(req);
        if (id === null)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('ID inválido'));
        if (id === req.user?.userId)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.validationError('No puedes eliminar tu propio usuario'));
        const estadoInactivo = await (0, estados_1.getEstadoByCodigo)('USUARIO', 'INACTIVO');
        if (!estadoInactivo)
            return (0, response_1.sendResponse)(res, response_1.ApiResponse.error("Estado 'INACTIVO' no encontrado"));
        await db_1.default.usuarioSistema.update({ where: { id_usuario: id }, data: { id_estado: estadoInactivo.id_estado } });
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.deleted('Usuario eliminado correctamente'));
    }
    catch (error) {
        return (0, response_1.sendResponse)(res, response_1.ApiResponse.error('Error al eliminar usuario', error));
    }
});
exports.default = router;
//# sourceMappingURL=usuarios.js.map