import { Router, Request, Response } from "express";
import prisma from "../config/db";
import {
	authenticateToken,
	AuthRequest,
	getCongregacionFilter,
} from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

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
	"/meta/tipos",
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

// Get members by estado - dinámico
router.get("/estado/:idEstado", authenticateToken, requirePermission("miembros", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const idEstado = getNumericId(req.params.idEstado);
		if (idEstado === null) {
			return res.status(400).json({ error: "ID de estado inválido" });
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
							cargoInstitucion: true
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
					visitaPastorals: true,
					peticionOraciones: true,
					asistenciaEventos: {
						include: { evento: true },
					},
					documentos: true,
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
			const {
				nombres,
				apellidos,
				fecha_nacimiento,
				genero,
				estado_civil,
				rut,
				telefono,
				email,
				direccion,
				foto_url,
				id_estado,
				id_congregacion,
				id_tipo_miembro,
			} = req.body;

			if (!nombres || !apellidos || !id_estado || !id_tipo_miembro) {
				return res
					.status(400)
					.json({ error: "Faltan campos requeridos" });
			}

			// Si no es admin, forzar la congregación del usuario
			let congregacionId = id_congregacion;
			const { nivel } = req.user || {};
			if (nivel !== "ADMIN" && req.user?.id_congregacion) {
				congregacionId = req.user.id_congregacion;
			}

			if (!congregacionId) {
				return res
					.status(400)
					.json({ error: "Debe especificar una congregación" });
			}

			const newMiembro = await prisma.miembro.create({
				data: {
					nombres,
					apellidos,
					fecha_nacimiento: fecha_nacimiento
						? new Date(fecha_nacimiento)
						: null,
					genero,
					estado_civil,
					rut,
					telefono,
					email,
					direccion,
					foto_url,
					id_estado,
					id_congregacion: congregacionId,
					id_tipo_miembro,
				},
				include: {
					estado: true,
					congregacion: true,
					tipoMiembro: true,
				},
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

			const updateData = { ...req.body };

			// Remove non-database fields
			delete updateData.id_miembro;
			delete updateData.created_at;
			delete updateData.updated_at;

			// Convert fecha_nacimiento if present
			if (updateData.fecha_nacimiento) {
				updateData.fecha_nacimiento = new Date(
					updateData.fecha_nacimiento,
				);
			}

			// Si no es admin, no permitir cambiar la congregación
			const { nivel } = req.user || {};
			if (nivel !== "ADMIN" && updateData.id_congregacion) {
				delete updateData.id_congregacion;
			}

			const updatedMiembro = await prisma.miembro.update({
				where: { id_miembro: memberId },
				data: updateData,
				include: {
					estado: true,
					congregacion: true,
					tipoMiembro: true,
				},
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

			console.log(">>> DELETE: Changing estado to 21 for member:", memberId);
			// Eliminación lógica: cambiar estado a Eliminado (estado 21)
			await prisma.miembro.update({
				where: { id_miembro: memberId },
				data: { id_estado: 21 } // ID 21 = Eliminado
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

		// Toggle: si está inactivo(6) -> activo(5), si está activo(5) -> inactivo(6)
		const nuevoEstado = existingMiembro.id_estado === 5 ? 6 : 5;
		
		await prisma.miembro.update({
			where: { id_miembro: memberId },
			data: { id_estado: nuevoEstado }
		});

		res.json({ message: nuevoEstado === 5 ? "Miembro activado" : "Miembro inactivado" });
	} catch (error) {
		console.error("Toggle miembro status error:", error);
		res.status(500).json({ error: "Error al cambiar estado del miembro" });
	}
});

// Get member types
// MOVED TO TOP - duplicates removed

export default router;
