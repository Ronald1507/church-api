import { Router, Request, Response } from "express";
import prisma from "../config/db";
import {
	authenticateToken,
	AuthRequest,
	getCongregacionFilter,
} from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { getEstadoByCodigo } from "../utils/estados";

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
			res.json(tipos);
		} catch (error) {
			res.status(500).json({
				error: "Error al obtener tipos de miembro",
			});
		}
	},
);

// Get metadata for member form (estados, congregaciones, tipos)
// Para no-admin, solo devuelve su congregación
router.get(
	"/opciones",
	authenticateToken,
	requirePermission("miembros", "leer"),
	async (req: AuthRequest, res: Response) => {
		try {
			let congregacionFilter = {};
			const { nivel } = req.user || {};

			// Si no es admin, solo puede ver su congregación
			if (nivel !== "ADMIN" && req.user?.id_congregacion) {
				congregacionFilter = {
					id_congregacion: req.user.id_congregacion,
				};
			}

			const [estados, congregaciones, tipos, instituciones] =
				await Promise.all([
					prisma.estado.findMany({
						where: { entidad: "MIEMBRO" },
						orderBy: { nombre: "asc" },
					}),
					prisma.congregacion.findMany({
						where: congregacionFilter,
						include: { estado: true },
						orderBy: { nombre: "asc" },
					}),
					prisma.tipoMiembro.findMany({
						orderBy: { nombre: "asc" },
					}),
					prisma.institucion.findMany({
						where: congregacionFilter,
						include: { estado: true },
						orderBy: { nombre: "asc" },
					}),
				]);
			res.json({ estados, congregaciones, tipos, instituciones });
		} catch (error) {
			console.error("Get metadata error:", error);
			res.status(500).json({ error: "Error al obtener metadatos" });
		}
	},
);

// Get all members - retorna todos los miembros
router.get("/", authenticateToken, requirePermission("miembros", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const congregacionFilter = getCongregacionFilter(req.user);
		
		const miembros = await prisma.miembro.findMany({ 
			where: {
				...congregacionFilter
			},
			take: 100,
			include: {
				estado: true,
				congregacion: true,
				tipoMiembro: true
			}
		});
		res.json(miembros);
	} catch (error) {
		console.error("Error getting miembros:", error);
		res.status(500).json({ error: "Error al obtener miembros" });
	}
});

// Get members by estado - valida que el estado pertenezca a MIEMBRO
router.get("/estado/:idEstado", authenticateToken, requirePermission("miembros", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const idEstado = getNumericId(req.params.idEstado);
		if (idEstado === null) {
			return res.status(400).json({ error: "ID de estado inválido" });
		}
		
		// Validar que el estado pertenece a la entidad MIEMBRO
		const estado = await prisma.estado.findUnique({
			where: { id_estado: idEstado }
		});
		
		if (!estado) {
			return res.status(404).json({ error: "Estado no encontrado" });
		}
		
		if (estado.entidad !== 'MIEMBRO') {
			return res.status(400).json({ error: `El estado ${idEstado} no pertenece a la entidad MIEMBRO` });
		}
		
		const congregacionFilter = getCongregacionFilter(req.user);
		const miembros = await prisma.miembro.findMany({ 
			where: {
				...congregacionFilter,
				id_estado: idEstado
			},
			take: 100,
			include: {
				estado: true,
				congregacion: true,
				tipoMiembro: true
			}
		});
		res.json(miembros);
	} catch (error) {
		console.error("Error getting members by estado:", error);
		res.status(500).json({ error: "Error al obtener miembros" });
	}
});

// Get member by ID - filtrado por congregación
router.get(
	"/:id",
	authenticateToken,
	requirePermission("miembros", "leer"),
	async (req: AuthRequest, res: Response) => {
		try {
			const memberId = getId(req);
			if (memberId === null) {
				return res
					.status(400)
					.json({ error: "ID de miembro inválido" });
			}

			const congregacionFilter = getCongregacionFilter(req.user);

			const miembro = await prisma.miembro.findFirst({
				where: {
					id_miembro: memberId,
					...congregacionFilter,
				},
				include: {
					estado: true,
					congregacion: true,
					tipoMiembro: true,
					miembroInstitucions: {
						include: { 
							institucion: true,
							estado: true
						},
					},
					relacionesOrigen: {
						include: { miembroDestino: true, tipoRelacion: true },
					},
					relacionesDestino: {
						include: { miembroOrigen: true, tipoRelacion: true },
					},
					historialEspirituals: {
						include: { tipoHito: true },
					},
					visitaPastorals: {
						include: { pastor: true, estado: true }
					},
					peticionOraciones: {
						include: { estado: true }
					},
					asistenciaEventos: {
						include: { evento: true },
					},
					documentos: {
						include: { estado: true }
					},
					ofrendaDizmos: true,
				},
			});

			if (!miembro) {
				return res.status(404).json({ error: "Miembro no encontrado" });
			}

			res.json(miembro);
		} catch (error) {
			console.error("Get miembro error:", error);
			res.status(500).json({ error: "Error al obtener miembro" });
		}
	},
);

// Create member
router.post(
	"/",
	authenticateToken,
	requirePermission("miembros", "crear"),
	async (req: AuthRequest, res: Response) => {
		try {
			const { nivel } = req.user || {};
			const input = req.body;

			// Validar campos requeridos
			if (!input.nombres || !input.apellidos || !input.id_estado || !input.id_tipo_miembro) {
				return res.status(400).json({ error: "Faltan campos requeridos" });
			}

			// Determinar congregación
			let id_congregacion: number;
			if (nivel === "ADMIN" && input.id_congregacion) {
				id_congregacion = parseInt(String(input.id_congregacion));
			} else if (req.user?.id_congregacion) {
				id_congregacion = req.user.id_congregacion;
			} else {
				return res.status(400).json({ error: "Debe especificar una congregación" });
			}

			if (isNaN(id_congregacion)) {
				return res.status(400).json({ error: "ID de congregación inválido" });
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

			res.status(201).json(newMiembro);
		} catch (error) {
			console.error("Create miembro error:", error);
			res.status(500).json({ error: "Error al crear miembro" });
		}
	},
);

// Update member
router.put(
	"/:id",
	authenticateToken,
	requirePermission("miembros", "actualizar"),
	async (req: AuthRequest, res: Response) => {
		try {
			const memberId = getId(req);
			if (memberId === null) {
				return res.status(400).json({ error: "ID de miembro inválido" });
			}

			const congregacionFilter = getCongregacionFilter(req.user);

			const existingMiembro = await prisma.miembro.findFirst({
				where: { id_miembro: memberId, ...congregacionFilter },
			});

			if (!existingMiembro) {
				return res.status(404).json({ error: "Miembro no encontrado" });
			}

			const input = req.body;
			
			// Campos válidos del modelo Miembro (sin relaciones, sin campos del sistema)
			const allowedFields = [
				'nombres', 'apellidos', 'fecha_nacimiento', 'genero', 
				'estado_civil', 'rut', 'telefono', 'email', 'direccion', 
				'foto_url', 'id_estado', 'id_congregacion', 'id_tipo_miembro'
			];
			
			// Construir objeto de update solo con campos válidos
			const updateData: Record<string, unknown> = {};
			
			for (const field of allowedFields) {
				if (field in input) {
					const value = input[field];
					
					// Campos que deben ser parseados a número
					if (['id_estado', 'id_congregacion', 'id_tipo_miembro'].includes(field)) {
						if (value === '' || value === null || value === undefined) {
							updateData[field] = existingMiembro[field as keyof typeof existingMiembro];
						} else {
							const parsed = parseInt(String(value));
							updateData[field] = isNaN(parsed) 
								? existingMiembro[field as keyof typeof existingMiembro] 
								: parsed;
						}
					}
					// Fecha de nacimiento
					else if (field === 'fecha_nacimiento') {
						if (!value || value === '') {
							updateData[field] = existingMiembro.fecha_nacimiento;
						} else if (value === null || value === 'null') {
							updateData[field] = null;
						} else {
							updateData[field] = new Date(value);
						}
					}
					// Otros campos opcionales
					else if (value === '' || value === undefined) {
						updateData[field] = existingMiembro[field as keyof typeof existingMiembro] ?? null;
					} else {
						updateData[field] = value;
					}
				}
			}

			// Si no es admin, no permitir cambiar la congregación
			const { nivel } = req.user || {};
			if (nivel !== "ADMIN") {
				delete updateData.id_congregacion;
			}

			const updatedMiembro = await prisma.miembro.update({
				where: { id_miembro: memberId },
				data: updateData,
				include: { estado: true, congregacion: true, tipoMiembro: true },
			});

			res.json(updatedMiembro);
		} catch (error) {
			console.error("Update miembro error:", error);
			res.status(500).json({ error: "Error al actualizar miembro" });
		}
	},
);

// Delete member (eliminación lógica)
router.delete(
	"/:id",
	authenticateToken,
	requirePermission("miembros", "eliminar"),
	async (req: AuthRequest, res: Response) => {
		try {
			console.log(">>> DELETE /:id reached with params:", req.params);
			const memberId = getId(req);
			if (memberId === null) {
				return res
					.status(400)
					.json({ error: "ID de miembro inválido" });
			}

			const congregacionFilter = getCongregacionFilter(req.user);

			// Verificar que el miembro pertenezca a la congregación del usuario
			const existingMiembro = await prisma.miembro.findFirst({
				where: {
					id_miembro: memberId,
					...congregacionFilter,
				},
			});

		if (!existingMiembro) {
			return res.status(404).json({ error: "Miembro no encontrado" });
		}

		// Eliminación lógica: buscar estado por código en vez de ID hardcodeado
		const estadoEliminado = await getEstadoByCodigo('MIEMBRO', 'ELIMINADO');
		if (!estadoEliminado) {
			return res.status(500).json({ error: "Estado 'ELIMINADO' no encontrado en la base de datos" });
		}

		await prisma.miembro.update({
			where: { id_miembro: memberId },
			data: { id_estado: estadoEliminado.id_estado }
		});

			res.json({ message: "Miembro eliminado" });
		} catch (error) {
			console.error("Delete miembro error:", error);
			res.status(500).json({ error: "Error al eliminar miembro" });
		}
	},
);

// Toggle member status (activar/inactivar)
router.patch("/:id/status", authenticateToken, requirePermission("miembros", "actualizar"), async (req: AuthRequest, res: Response) => {
	try {
		const memberId = getId(req);
		if (memberId === null) {
			return res.status(400).json({ error: "ID de miembro inválido" });
		}

		const congregacionFilter = getCongregacionFilter(req.user);

		const existingMiembro = await prisma.miembro.findFirst({
			where: {
				id_miembro: memberId,
				...congregacionFilter,
			},
		});

		if (!existingMiembro) {
			return res.status(404).json({ error: "Miembro no encontrado" });
		}

		// Toggle: buscar estados por código en vez de IDs hardcodeados
		const estadoActivo = await getEstadoByCodigo('MIEMBRO', 'ACTIVO');
		const estadoInactivo = await getEstadoByCodigo('MIEMBRO', 'INACTIVO');
		
		if (!estadoActivo || !estadoInactivo) {
			return res.status(500).json({ error: "Estados 'ACTIVO' o 'INACTIVO' no encontrados en la base de datos" });
		}

		const nuevoEstado = existingMiembro.id_estado === estadoActivo.id_estado 
			? estadoInactivo.id_estado 
			: estadoActivo.id_estado;
		
		await prisma.miembro.update({
			where: { id_miembro: memberId },
			data: { id_estado: nuevoEstado }
		});

		res.json({ message: nuevoEstado === estadoActivo.id_estado ? "Miembro activado" : "Miembro inactivado" });
	} catch (error) {
		console.error("Toggle miembro status error:", error);
		res.status(500).json({ error: "Error al cambiar estado del miembro" });
	}
});

// Get member types
// MOVED TO TOP - duplicates removed

export default router;
