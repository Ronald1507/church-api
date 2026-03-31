import { Router, Request, Response } from "express";
import prisma from "../config/db";
import {
	authenticateToken,
	AuthRequest,
	getCongregacionFilter,
} from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router = Router();

// Helper to get numeric ID from params
const getId = (req: Request): number | null => {
	const id = req.params.id;
	const num = typeof id === "string" ? parseInt(id) : parseInt(id?.[0] || "");
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

// Get all members - MINIMAL WITH LOGGING
router.get("/", authenticateToken, requirePermission("miembros", "leer"), async (req: AuthRequest, res: Response) => {
	console.log("GET /miembros called - user:", req.user);
	try {
		const congregacionFilter = getCongregacionFilter(req.user);
		const miembros = await prisma.miembro.findMany({ 
			where: congregacionFilter,
			take: 100 
		});
		console.log("Found:", miembros.length);
		res.json(miembros);
	} catch (error: unknown) {
		const err = error as Error;
		console.error("Error:", err.message);
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

// Delete member
router.delete(
	"/:id",
	authenticateToken,
	requirePermission("miembros", "eliminar"),
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

			await prisma.miembro.delete({
				where: { id_miembro: memberId },
			});

			res.json({ message: "Miembro eliminado correctamente" });
		} catch (error) {
			console.error("Delete miembro error:", error);
			res.status(500).json({ error: "Error al eliminar miembro" });
		}
	},
);

// Get member types
// MOVED TO TOP - duplicates removed

export default router;
