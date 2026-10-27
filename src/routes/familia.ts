import { Router, Request, Response } from "express";
import prisma from "../config/db";
import {
	authenticateToken,
	AuthRequest,
	getCongregacionFilter,
} from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { ApiResponse, sendResponse } from "../utils/response";

const router = Router();

const getNumericId = (param: string | string[]): number | null => {
	const value = Array.isArray(param) ? param[0] : param;
	const num = parseInt(value);
	return isNaN(num) ? null : num;
};

// ============================================
// LISTADOS
// ============================================

// Listado de tipos de relación familiar
router.get("/listado/tipos", authenticateToken, requirePermission("familia", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const tipos = await prisma.tipoRelacionFamiliar.findMany({ orderBy: { nombre: "asc" } });
		return sendResponse(res, ApiResponse.success(tipos));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener tipos de relación", error));
	}
});

// Listado de miembros para selects (scoped por congregación)
router.get("/listado/miembros", authenticateToken, requirePermission("familia", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const congregacionFilter = getCongregacionFilter(req.user);
		const miembros = await prisma.miembro.findMany({
			where: { ...congregacionFilter },
			select: { id_miembro: true, nombres: true, apellidos: true },
			orderBy: { apellidos: "asc" },
		});
		return sendResponse(res, ApiResponse.success(miembros));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener miembros", error));
	}
});

// ============================================
// CRUD RELACIONES FAMILIARES
// ============================================

// GET todas las relaciones (scope por congregación del miembro origen)
router.get("/", authenticateToken, requirePermission("familia", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const congregacionFilter = getCongregacionFilter(req.user);
		const relaciones = await prisma.relacionFamiliar.findMany({
			where: { miembroOrigen: { ...congregacionFilter } },
			take: 200,
			include: {
				miembroOrigen: { select: { id_miembro: true, nombres: true, apellidos: true } },
				miembroDestino: { select: { id_miembro: true, nombres: true, apellidos: true } },
				tipoRelacion: true,
			},
			orderBy: { fecha_registro: "desc" },
		});
		return sendResponse(res, ApiResponse.success(relaciones));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener relaciones familiares", error));
	}
});

// GET relaciones de un miembro (como origen o destino)
router.get("/miembro/:idMiembro", authenticateToken, requirePermission("familia", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const idMiembro = getNumericId(req.params.idMiembro);
		if (idMiembro === null) {
			return sendResponse(res, ApiResponse.validationError("ID de miembro inválido"));
		}

		const congregacionFilter = getCongregacionFilter(req.user);
		const miembro = await prisma.miembro.findFirst({ where: { id_miembro: idMiembro, ...congregacionFilter } });
		if (!miembro) {
			return sendResponse(res, ApiResponse.notFound("Miembro no encontrado"));
		}

		const relaciones = await prisma.relacionFamiliar.findMany({
			where: { OR: [{ id_miembro_origen: idMiembro }, { id_miembro_destino: idMiembro }] },
			include: {
				miembroOrigen: { select: { id_miembro: true, nombres: true, apellidos: true } },
				miembroDestino: { select: { id_miembro: true, nombres: true, apellidos: true } },
				tipoRelacion: true,
			},
			orderBy: { fecha_registro: "desc" },
		});
		return sendResponse(res, ApiResponse.success(relaciones));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener relaciones del miembro", error));
	}
});

// POST crear relación familiar
router.post("/", authenticateToken, requirePermission("familia", "crear"), async (req: AuthRequest, res: Response) => {
	try {
		const { id_miembro_origen, id_miembro_destino, id_tipo_relacion } = req.body;

		if (!id_miembro_origen || !id_miembro_destino || !id_tipo_relacion) {
			return sendResponse(res, ApiResponse.validationError("Faltan campos requeridos"));
		}
		if (parseInt(String(id_miembro_origen)) === parseInt(String(id_miembro_destino))) {
			return sendResponse(res, ApiResponse.validationError("Un miembro no puede relacionarse consigo mismo"));
		}

		// Verificar que ambos miembros existen y son accesibles
		const congregacionFilter = getCongregacionFilter(req.user);
		const origen = await prisma.miembro.findFirst({ where: { id_miembro: parseInt(String(id_miembro_origen)), ...congregacionFilter } });
		const destino = await prisma.miembro.findFirst({ where: { id_miembro: parseInt(String(id_miembro_destino)), ...congregacionFilter } });
		if (!origen || !destino) {
			return sendResponse(res, ApiResponse.notFound("Uno o ambos miembros no existen o no son accesibles"));
		}

		const nueva = await prisma.relacionFamiliar.create({
			data: {
				id_miembro_origen: parseInt(String(id_miembro_origen)),
				id_miembro_destino: parseInt(String(id_miembro_destino)),
				id_tipo_relacion: parseInt(String(id_tipo_relacion)),
			},
			include: {
				miembroOrigen: { select: { id_miembro: true, nombres: true, apellidos: true } },
				miembroDestino: { select: { id_miembro: true, nombres: true, apellidos: true } },
				tipoRelacion: true,
			},
		});
		return sendResponse(res, ApiResponse.created(nueva, "Relación familiar creada correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al crear relación familiar", error));
	}
});

// PUT actualizar tipo de relación
router.put("/:id", authenticateToken, requirePermission("familia", "actualizar"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) {
			return sendResponse(res, ApiResponse.validationError("ID inválido"));
		}

		const congregacionFilter = getCongregacionFilter(req.user);
		const existing = await prisma.relacionFamiliar.findFirst({ where: { id, miembroOrigen: { ...congregacionFilter } } });
		if (!existing) {
			return sendResponse(res, ApiResponse.notFound("Relación no encontrada"));
		}

		const { id_tipo_relacion } = req.body;
		if (!id_tipo_relacion) {
			return sendResponse(res, ApiResponse.validationError("Falta el tipo de relación"));
		}

		const actualizada = await prisma.relacionFamiliar.update({
			where: { id },
			data: { id_tipo_relacion: parseInt(String(id_tipo_relacion)) },
			include: {
				miembroOrigen: { select: { id_miembro: true, nombres: true, apellidos: true } },
				miembroDestino: { select: { id_miembro: true, nombres: true, apellidos: true } },
				tipoRelacion: true,
			},
		});
		return sendResponse(res, ApiResponse.updated(actualizada, "Relación familiar actualizada correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al actualizar relación familiar", error));
	}
});

// DELETE relación (eliminación física: no tiene estado)
router.delete("/:id", authenticateToken, requirePermission("familia", "eliminar"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) {
			return sendResponse(res, ApiResponse.validationError("ID inválido"));
		}

		const congregacionFilter = getCongregacionFilter(req.user);
		const existing = await prisma.relacionFamiliar.findFirst({ where: { id, miembroOrigen: { ...congregacionFilter } } });
		if (!existing) {
			return sendResponse(res, ApiResponse.notFound("Relación no encontrada"));
		}

		await prisma.relacionFamiliar.delete({ where: { id } });
		return sendResponse(res, ApiResponse.deleted("Relación familiar eliminada correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al eliminar relación familiar", error));
	}
});

export default router;
