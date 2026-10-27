import { Router, Request, Response } from "express";
import prisma from "../config/db";
import {
	authenticateToken,
	AuthRequest,
	getCongregacionFilter,
} from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { getEstadoByCodigo } from "../utils/estados";
import { ApiResponse, sendResponse } from "../utils/response";

const router = Router();

// Helper to get numeric ID from params
const getId = (req: Request): number | null => {
	return getNumericId(req.params.id);
};

const getNumericId = (param: string | string[]): number | null => {
	const value = Array.isArray(param) ? param[0] : param;
	const num = parseInt(value);
	return isNaN(num) ? null : num;
};

// ============================================
// LISTADOS SEPARADOS (uno para cada cosa)
// ============================================

// Listado de estados de miembros
router.get(
	"/listado/estados",
	authenticateToken,
	requirePermission("miembros", "leer"),
	async (req: AuthRequest, res: Response) => {
		try {
			const estados = await prisma.estado.findMany({
				where: { entidad: "MIEMBRO" },
				orderBy: { nombre: "asc" }
			});
			return sendResponse(res, ApiResponse.success(estados));
		} catch (error) {
			return sendResponse(res, ApiResponse.error('Error al obtener estados', error));
		}
	}
);

// Listado de congregaciones para miembros
router.get(
	"/listado/congregaciones",
	authenticateToken,
	requirePermission("miembros", "leer"),
	async (req: AuthRequest, res: Response) => {
		try {
			const congregacionFilter = getCongregacionFilter(req.user);
			const congregaciones = await prisma.congregacion.findMany({
				where: congregacionFilter,
				include: { estado: true },
				orderBy: { nombre: "asc" }
			});
			return sendResponse(res, ApiResponse.success(congregaciones));
		} catch (error) {
			return sendResponse(res, ApiResponse.error('Error al obtener congregaciones', error));
		}
	}
);

// Listado de tipos de miembro
router.get(
	"/listado/tipos",
	authenticateToken,
	requirePermission("miembros", "leer"),
	async (req: AuthRequest, res: Response) => {
		try {
			const tipos = await prisma.tipoMiembro.findMany({
				orderBy: { nombre: "asc" }
			});
			return sendResponse(res, ApiResponse.success(tipos));
		} catch (error) {
			return sendResponse(res, ApiResponse.error('Error al obtener tipos', error));
		}
	}
);

// Listado de instituciones para miembros
router.get(
	"/listado/instituciones",
	authenticateToken,
	requirePermission("miembros", "leer"),
	async (req: AuthRequest, res: Response) => {
		try {
			const congregacionFilter = getCongregacionFilter(req.user);
			const instituciones = await prisma.institucion.findMany({
				where: congregacionFilter,
				include: { estado: true },
				orderBy: { nombre: "asc" }
			});
			return sendResponse(res, ApiResponse.success(instituciones));
		} catch (error) {
			return sendResponse(res, ApiResponse.error('Error al obtener instituciones', error));
		}
	}
);

// ============================================
// CRUD
// ============================================

// GET all members
router.get("/", authenticateToken, requirePermission("miembros", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const congregacionFilter = getCongregacionFilter(req.user);
		
		const miembros = await prisma.miembro.findMany({ 
			where: { ...congregacionFilter },
			take: 100,
			include: { 
				estado: true, 
				congregacion: true, 
				tipoMiembro: true,
				miembroInstitucions: { include: { institucion: true } }
			}
		});
		
		return sendResponse(res, ApiResponse.success(miembros));
	} catch (error) {
		return sendResponse(res, ApiResponse.error('Error al obtener miembros', error));
	}
});

// GET members by estado
router.get("/estado/:idEstado", authenticateToken, requirePermission("miembros", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const idEstado = getNumericId(req.params.idEstado);
		if (idEstado === null) {
			return sendResponse(res, ApiResponse.validationError('ID de estado inválido'));
		}
		
		const estado = await prisma.estado.findUnique({ where: { id_estado: idEstado } });
		
		if (!estado) {
			return sendResponse(res, ApiResponse.notFound('Estado no encontrado'));
		}
		
		if (estado.entidad !== 'MIEMBRO') {
			return sendResponse(res, ApiResponse.validationError(`El estado no pertenece a MIEMBRO`));
		}
		
		const congregacionFilter = getCongregacionFilter(req.user);
		const miembros = await prisma.miembro.findMany({ 
			where: { ...congregacionFilter, id_estado: idEstado },
			take: 100,
			include: { estado: true, congregacion: true, tipoMiembro: true }
		});
		
		return sendResponse(res, ApiResponse.success(miembros));
	} catch (error) {
		return sendResponse(res, ApiResponse.error('Error al obtener miembros', error));
	}
});

// GET member by ID
router.get("/:id", authenticateToken, requirePermission("miembros", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const memberId = getId(req);
		if (memberId === null) {
			return sendResponse(res, ApiResponse.validationError('ID de miembro inválido'));
		}

		const congregacionFilter = getCongregacionFilter(req.user);

		const miembro = await prisma.miembro.findFirst({
			where: { id_miembro: memberId, ...congregacionFilter },
			include: {
				estado: true,
				congregacion: true,
				tipoMiembro: true,
				miembroInstitucions: { include: { institucion: true, estado: true } },
				relacionesOrigen: { include: { miembroDestino: true, tipoRelacion: true } },
				relacionesDestino: { include: { miembroOrigen: true, tipoRelacion: true } },
				historialEspirituals: { include: { tipoHito: true } },
				visitaPastorals: { include: { pastor: true, estado: true } },
				peticionOraciones: { include: { estado: true } },
				asistenciaEventos: { include: { evento: true } },
				documentos: { include: { estado: true } },
				ofrendaDizmos: true,
			},
		});

		if (!miembro) {
			return sendResponse(res, ApiResponse.notFound('Miembro no encontrado'));
		}

		return sendResponse(res, ApiResponse.success(miembro));
	} catch (error) {
		return sendResponse(res, ApiResponse.error('Error al obtener miembro', error));
	}
});

// POST create member
router.post("/", authenticateToken, requirePermission("miembros", "crear"), async (req: AuthRequest, res: Response) => {
	try {
		const { nivel } = req.user || {};
		const input = req.body;

		if (!input.nombres || !input.apellidos || !input.id_estado || !input.id_tipo_miembro) {
			return sendResponse(res, ApiResponse.validationError('Faltan campos requeridos'));
		}

		let id_congregacion: number;
		if ((nivel === "ADMIN" || nivel === "SUPERADMIN") && input.id_congregacion) {
			id_congregacion = parseInt(String(input.id_congregacion));
		} else if (req.user?.id_congregacion) {
			id_congregacion = req.user.id_congregacion;
		} else {
			return sendResponse(res, ApiResponse.validationError('Debe especificar una congregación'));
		}

		if (isNaN(id_congregacion)) {
			return sendResponse(res, ApiResponse.validationError('ID de congregación inválido'));
		}

		// Crear miembro
		const newMiembro = await prisma.miembro.create({
			data: {
				nombres: input.nombres,
				apellidos: input.apellidos,
				fecha_nacimiento: input.fecha_nacimiento ? new Date(input.fecha_nacimiento) : null,
				genero: input.genero || null,
				estado_civil: input.estado_civil || null,
				rut: input.rut || null,
				telefono: input.telefono || null,
				email: input.email || null,
				direccion: input.direccion || null,
				foto_url: input.foto_url || null,
				id_estado: parseInt(String(input.id_estado)),
				id_congregacion,
				id_tipo_miembro: parseInt(String(input.id_tipo_miembro)),
			},
			include: { estado: true, congregacion: true, tipoMiembro: true },
		});

		// Crear relaciones con instituciones si se proporcionan
		if (input.instituciones && Array.isArray(input.instituciones)) {
			const nuevasInstituciones = input.instituciones.map((id: number) => ({
				id_miembro: newMiembro.id_miembro,
				id_institucion: parseInt(String(id)),
				id_estado: 1,
			}));

			if (nuevasInstituciones.length > 0) {
				await prisma.miembroInstitucion.createMany({
					data: nuevasInstituciones
				});
			}
		}

		// Retornar miembro con instituciones
		const miembroCompleto = await prisma.miembro.findUnique({
			where: { id_miembro: newMiembro.id_miembro },
			include: {
				estado: true,
				congregacion: true,
				tipoMiembro: true,
				miembroInstitucions: { include: { institucion: true } }
			}
		});

		return sendResponse(res, ApiResponse.created(miembroCompleto, 'Miembro creado correctamente'));
	} catch (error) {
		return sendResponse(res, ApiResponse.error('Error al crear miembro', error));
	}
});

// PUT update member
router.put("/:id", authenticateToken, requirePermission("miembros", "actualizar"), async (req: AuthRequest, res: Response) => {
	try {
		const memberId = getId(req);
		if (memberId === null) {
			return sendResponse(res, ApiResponse.validationError('ID de miembro inválido'));
		}

		const congregacionFilter = getCongregacionFilter(req.user);
		const existingMiembro = await prisma.miembro.findFirst({
			where: { id_miembro: memberId, ...congregacionFilter },
		});

		if (!existingMiembro) {
			return sendResponse(res, ApiResponse.notFound('Miembro no encontrado'));
		}

		const input = req.body;
		const allowedFields = ['nombres', 'apellidos', 'fecha_nacimiento', 'genero', 'estado_civil', 'rut', 'telefono', 'email', 'direccion', 'foto_url', 'id_estado', 'id_congregacion', 'id_tipo_miembro'];
		
		const updateData: Record<string, unknown> = {};
		
		for (const field of allowedFields) {
			if (field in input) {
				const value = input[field];
				
				if (['id_estado', 'id_congregacion', 'id_tipo_miembro'].includes(field)) {
					if (value === '' || value === null || value === undefined) {
						updateData[field] = existingMiembro[field as keyof typeof existingMiembro];
					} else {
						const parsed = parseInt(String(value));
						updateData[field] = isNaN(parsed) ? existingMiembro[field as keyof typeof existingMiembro] : parsed;
					}
				} else if (field === 'fecha_nacimiento') {
					if (!value || value === '') {
						updateData[field] = existingMiembro.fecha_nacimiento;
					} else if (value === null || value === 'null') {
						updateData[field] = null;
					} else {
						updateData[field] = new Date(value);
					}
				} else if (value === '' || value === undefined) {
					updateData[field] = existingMiembro[field as keyof typeof existingMiembro] ?? null;
				} else {
					updateData[field] = value;
				}
			}
		}

		const { nivel } = req.user || {};
		if (nivel !== "ADMIN" && nivel !== "SUPERADMIN") {
			delete updateData.id_congregacion;
		}

		// Actualizar miembro
		const updatedMiembro = await prisma.miembro.update({
			where: { id_miembro: memberId },
			data: updateData,
			include: { estado: true, congregacion: true, tipoMiembro: true },
		});

		// Manejar instituciones (tabla intermedia)
		if (input.instituciones && Array.isArray(input.instituciones)) {
			const nuevasInstituciones = input.instituciones.map((id: number) => ({
				id_miembro: memberId,
				id_institucion: parseInt(String(id)),
				id_estado: 1, // Por defecto ACTIVO
			}));

			// Eliminar instituciones actuales
			await prisma.miembroInstitucion.deleteMany({
				where: { id_miembro: memberId }
			});

			// Crear nuevas relaciones
			if (nuevasInstituciones.length > 0) {
				await prisma.miembroInstitucion.createMany({
					data: nuevasInstituciones
				});
			}
		}

		// Retornar miembro con instituciones actualizadas
		const miembroConInstituciones = await prisma.miembro.findUnique({
			where: { id_miembro: memberId },
			include: {
				estado: true,
				congregacion: true,
				tipoMiembro: true,
				miembroInstitucions: { include: { institucion: true } }
			}
		});

		return sendResponse(res, ApiResponse.updated(miembroConInstituciones, 'Miembro actualizado correctamente'));
	} catch (error) {
		return sendResponse(res, ApiResponse.error('Error al actualizar miembro', error));
	}
});

// DELETE member (logical deletion)
router.delete("/:id", authenticateToken, requirePermission("miembros", "eliminar"), async (req: AuthRequest, res: Response) => {
	try {
		const memberId = getId(req);
		if (memberId === null) {
			return sendResponse(res, ApiResponse.validationError('ID de miembro inválido'));
		}

		const congregacionFilter = getCongregacionFilter(req.user);
		const existingMiembro = await prisma.miembro.findFirst({
			where: { id_miembro: memberId, ...congregacionFilter },
		});

		if (!existingMiembro) {
			return sendResponse(res, ApiResponse.notFound('Miembro no encontrado'));
		}

		const estadoEliminado = await getEstadoByCodigo('MIEMBRO', 'ELIMINADO');
		if (!estadoEliminado) {
			return sendResponse(res, ApiResponse.error("Estado 'ELIMINADO' no encontrado"));
		}

		await prisma.miembro.update({
			where: { id_miembro: memberId },
			data: { id_estado: estadoEliminado.id_estado }
		});

		return sendResponse(res, ApiResponse.deleted('Miembro eliminado correctamente'));
	} catch (error) {
		return sendResponse(res, ApiResponse.error('Error al eliminar miembro', error));
	}
});

// PATCH toggle member status
router.patch("/:id/status", authenticateToken, requirePermission("miembros", "actualizar"), async (req: AuthRequest, res: Response) => {
	try {
		const memberId = getId(req);
		if (memberId === null) {
			return sendResponse(res, ApiResponse.validationError('ID de miembro inválido'));
		}

		const congregacionFilter = getCongregacionFilter(req.user);
		const existingMiembro = await prisma.miembro.findFirst({
			where: { id_miembro: memberId, ...congregacionFilter },
		});

		if (!existingMiembro) {
			return sendResponse(res, ApiResponse.notFound('Miembro no encontrado'));
		}

		const estadoActivo = await getEstadoByCodigo('MIEMBRO', 'ACTIVO');
		const estadoInactivo = await getEstadoByCodigo('MIEMBRO', 'INACTIVO');
		
		if (!estadoActivo || !estadoInactivo) {
			return sendResponse(res, ApiResponse.error("Estados no encontrados"));
		}

		const nuevoEstado = existingMiembro.id_estado === estadoActivo.id_estado ? estadoInactivo.id_estado : estadoActivo.id_estado;
		
		await prisma.miembro.update({
			where: { id_miembro: memberId },
			data: { id_estado: nuevoEstado }
		});

		const mensaje = nuevoEstado === estadoActivo.id_estado ? 'Miembro activado correctamente' : 'Miembro inactivado correctamente';
		return sendResponse(res, ApiResponse.success(null, mensaje));
	} catch (error) {
		return sendResponse(res, ApiResponse.error('Error al cambiar estado del miembro', error));
	}
});

export default router;