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

console.log("===-miembros.ts loaded===");

const router = Router();

// Helper to get numeric ID from params
const getId = (req: Request): number | null => {
	return getNumericId(req.params.id);
};

// Helper to get numeric ID from any param
const getNumericId = (param: string | string[]): number | null => {
	const value = Array.isArray(param) ? param[0] : param;
	const num = parseInt(value);
	return isNaN(num) ? null : num;
};

// Get member types
router.get(
	"/opciones/tipos",
	authenticateToken,
	requirePermission("miembros", "leer"),
	async (req: AuthRequest, res: Response) => {
		try {
			const tipos = await prisma.tipoMiembro.findMany({
				orderBy: { nombre: "asc" },
			});
			return sendResponse(res, ApiResponse.success(tipos, 'Tipos de miembro obtenidos'));
		} catch (error) {
			console.error("Error getting tipos:", error);
			return sendResponse(res, ApiResponse.error('Error al obtener tipos de miembro', error));
		}
	},
);

// Get metadata for member form (estados, congregaciones, tipos)
router.get(
	"/opciones",
	authenticateToken,
	requirePermission("miembros", "leer"),
	async (req: AuthRequest, res: Response) => {
		try {
			let congregacionFilter = {};
			const { nivel } = req.user || {};

			if (nivel !== "ADMIN" && req.user?.id_congregacion) {
				congregacionFilter = { id_congregacion: req.user.id_congregacion };
			}

			const [estados, congregaciones, tipos, instituciones] = await Promise.all([
				prisma.estado.findMany({ where: { entidad: "MIEMBRO" }, orderBy: { nombre: "asc" } }),
				prisma.congregacion.findMany({ where: congregacionFilter, include: { estado: true }, orderBy: { nombre: "asc" } }),
				prisma.tipoMiembro.findMany({ orderBy: { nombre: "asc" } }),
				prisma.institucion.findMany({ where: congregacionFilter, include: { estado: true }, orderBy: { nombre: "asc" } }),
			]);

			return sendResponse(res, ApiResponse.success({ estados, congregaciones, tipos, instituciones }));
		} catch (error) {
			console.error("Get metadata error:", error);
			return sendResponse(res, ApiResponse.error('Error al obtener metadatos', error));
		}
	},
);

// Get all members
router.get("/", authenticateToken, requirePermission("miembros", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const congregacionFilter = getCongregacionFilter(req.user);
		
		const miembros = await prisma.miembro.findMany({ 
			where: { ...congregacionFilter },
			take: 100,
			include: { estado: true, congregacion: true, tipoMiembro: true }
		});
		
		return sendResponse(res, ApiResponse.success(miembros, 'Miembros obtenidos'));
	} catch (error) {
		console.error("Error getting miembros:", error);
		return sendResponse(res, ApiResponse.error('Error al obtener miembros', error));
	}
});

// Get members by estado
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
			return sendResponse(res, ApiResponse.validationError(`El estado ${idEstado} no pertenece a la entidad MIEMBRO`));
		}
		
		const congregacionFilter = getCongregacionFilter(req.user);
		const miembros = await prisma.miembro.findMany({ 
			where: { ...congregacionFilter, id_estado: idEstado },
			take: 100,
			include: { estado: true, congregacion: true, tipoMiembro: true }
		});
		
		return sendResponse(res, ApiResponse.success(miembros, 'Miembros obtenidos por estado'));
	} catch (error) {
		console.error("Error getting members by estado:", error);
		return sendResponse(res, ApiResponse.error('Error al obtener miembros', error));
	}
});

// Get member by ID
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
		console.error("Get miembro error:", error);
		return sendResponse(res, ApiResponse.error('Error al obtener miembro', error));
	}
});

// Create member
router.post("/", authenticateToken, requirePermission("miembros", "crear"), async (req: AuthRequest, res: Response) => {
	try {
		const { nivel } = req.user || {};
		const input = req.body;

		if (!input.nombres || !input.apellidos || !input.id_estado || !input.id_tipo_miembro) {
			return sendResponse(res, ApiResponse.validationError('Faltan campos requeridos'));
		}

		let id_congregacion: number;
		if (nivel === "ADMIN" && input.id_congregacion) {
			id_congregacion = parseInt(String(input.id_congregacion));
		} else if (req.user?.id_congregacion) {
			id_congregacion = req.user.id_congregacion;
		} else {
			return sendResponse(res, ApiResponse.validationError('Debe especificar una congregación'));
		}

		if (isNaN(id_congregacion)) {
			return sendResponse(res, ApiResponse.validationError('ID de congregación inválido'));
		}

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

		return sendResponse(res, ApiResponse.created(newMiembro, 'Miembro creado correctamente'));
	} catch (error) {
		console.error("Create miembro error:", error);
		return sendResponse(res, ApiResponse.error('Error al crear miembro', error));
	}
});

// Update member
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
		if (nivel !== "ADMIN") {
			delete updateData.id_congregacion;
		}

		const updatedMiembro = await prisma.miembro.update({
			where: { id_miembro: memberId },
			data: updateData,
			include: { estado: true, congregacion: true, tipoMiembro: true },
		});

		return sendResponse(res, ApiResponse.updated(updatedMiembro, 'Miembro actualizado correctamente'));
	} catch (error) {
		console.error("Update miembro error:", error);
		return sendResponse(res, ApiResponse.error('Error al actualizar miembro', error));
	}
});

// Delete member (logical deletion)
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
			return sendResponse(res, ApiResponse.error("Estado 'ELIMINADO' no encontrado en la base de datos"));
		}

		await prisma.miembro.update({
			where: { id_miembro: memberId },
			data: { id_estado: estadoEliminado.id_estado }
		});

		return sendResponse(res, ApiResponse.deleted('Miembro eliminado correctamente'));
	} catch (error) {
		console.error("Delete miembro error:", error);
		return sendResponse(res, ApiResponse.error('Error al eliminar miembro', error));
	}
});

// Toggle member status
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
			return sendResponse(res, ApiResponse.error("Estados 'ACTIVO' o 'INACTIVO' no encontrados"));
		}

		const nuevoEstado = existingMiembro.id_estado === estadoActivo.id_estado ? estadoInactivo.id_estado : estadoActivo.id_estado;
		
		await prisma.miembro.update({
			where: { id_miembro: memberId },
			data: { id_estado: nuevoEstado }
		});

		const mensaje = nuevoEstado === estadoActivo.id_estado ? 'Miembro activado correctamente' : 'Miembro inactivado correctamente';
		return sendResponse(res, ApiResponse.success(null, mensaje));
	} catch (error) {
		console.error("Toggle miembro status error:", error);
		return sendResponse(res, ApiResponse.error('Error al cambiar estado del miembro', error));
	}
});

export default router;
