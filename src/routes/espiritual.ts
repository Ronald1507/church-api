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

// Listado de tipos de hito espiritual
router.get("/listado/tipos", authenticateToken, requirePermission("espiritual", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const tipos = await prisma.tipoHito.findMany({ orderBy: { nombre: "asc" } });
		return sendResponse(res, ApiResponse.success(tipos));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener tipos de hito", error));
	}
});

// Listado de miembros para selects (scoped por congregación)
router.get("/listado/miembros", authenticateToken, requirePermission("espiritual", "leer"), async (req: AuthRequest, res: Response) => {
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
// CRUD TIPOS DE HITO (catálogo)
// ============================================
router.post("/tipos", authenticateToken, requirePermission("espiritual", "crear"), async (req: AuthRequest, res: Response) => {
	try {
		const { nombre, descripcion, requiere_ministro, genera_documento } = req.body;
		if (!nombre) {
			return sendResponse(res, ApiResponse.validationError("El nombre es requerido"));
		}
		const tipo = await prisma.tipoHito.create({
			data: {
				nombre,
				descripcion: descripcion || null,
				requiere_ministro: requiere_ministro ?? true,
				genera_documento: genera_documento ?? false,
			},
		});
		return sendResponse(res, ApiResponse.created(tipo, "Tipo de hito creado correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al crear tipo de hito", error));
	}
});

// ============================================
// CRUD HISTORIAL ESPIRITUAL
// ============================================

// GET todo el historial (scope por congregación del miembro)
router.get("/", authenticateToken, requirePermission("espiritual", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const congregacionFilter = getCongregacionFilter(req.user);
		const historial = await prisma.historialEspiritual.findMany({
			where: { miembro: { ...congregacionFilter } },
			take: 200,
			include: {
				miembro: { select: { id_miembro: true, nombres: true, apellidos: true } },
				tipoHito: true,
			},
			orderBy: { fecha_hito: "desc" },
		});
		return sendResponse(res, ApiResponse.success(historial));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener historial espiritual", error));
	}
});

// GET historial de un miembro
router.get("/miembro/:idMiembro", authenticateToken, requirePermission("espiritual", "leer"), async (req: AuthRequest, res: Response) => {
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
		const historial = await prisma.historialEspiritual.findMany({
			where: { id_miembro: idMiembro },
			include: { tipoHito: true },
			orderBy: { fecha_hito: "desc" },
		});
		return sendResponse(res, ApiResponse.success(historial));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener historial del miembro", error));
	}
});

// GET hito por ID
router.get("/:id", authenticateToken, requirePermission("espiritual", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) {
			return sendResponse(res, ApiResponse.validationError("ID inválido"));
		}
		const congregacionFilter = getCongregacionFilter(req.user);
		const hito = await prisma.historialEspiritual.findFirst({
			where: { id_hito: id, miembro: { ...congregacionFilter } },
			include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, tipoHito: true },
		});
		if (!hito) {
			return sendResponse(res, ApiResponse.notFound("Hito no encontrado"));
		}
		return sendResponse(res, ApiResponse.success(hito));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener hito", error));
	}
});

// POST crear hito
router.post("/", authenticateToken, requirePermission("espiritual", "crear"), async (req: AuthRequest, res: Response) => {
	try {
		const { id_miembro, id_tipo_hito, fecha_hito, lugar, id_ministro, observaciones, documento_url } = req.body;
		if (!id_miembro || !id_tipo_hito || !fecha_hito) {
			return sendResponse(res, ApiResponse.validationError("Faltan campos requeridos"));
		}

		const congregacionFilter = getCongregacionFilter(req.user);
		const miembro = await prisma.miembro.findFirst({ where: { id_miembro: parseInt(String(id_miembro)), ...congregacionFilter } });
		if (!miembro) {
			return sendResponse(res, ApiResponse.notFound("Miembro no encontrado o no accesible"));
		}

		const hito = await prisma.historialEspiritual.create({
			data: {
				id_miembro: parseInt(String(id_miembro)),
				id_tipo_hito: parseInt(String(id_tipo_hito)),
				fecha_hito: new Date(fecha_hito),
				lugar: lugar || null,
				id_ministro: id_ministro ? parseInt(String(id_ministro)) : null,
				observaciones: observaciones || null,
				documento_url: documento_url || null,
			},
			include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, tipoHito: true },
		});
		return sendResponse(res, ApiResponse.created(hito, "Hito espiritual registrado correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al registrar hito espiritual", error));
	}
});

// PUT actualizar hito
router.put("/:id", authenticateToken, requirePermission("espiritual", "actualizar"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) {
			return sendResponse(res, ApiResponse.validationError("ID inválido"));
		}
		const congregacionFilter = getCongregacionFilter(req.user);
		const existing = await prisma.historialEspiritual.findFirst({ where: { id_hito: id, miembro: { ...congregacionFilter } } });
		if (!existing) {
			return sendResponse(res, ApiResponse.notFound("Hito no encontrado"));
		}

		const input = req.body;
		const updateData: Record<string, unknown> = {};
		if (input.id_tipo_hito !== undefined) updateData.id_tipo_hito = parseInt(String(input.id_tipo_hito));
		if (input.fecha_hito !== undefined && input.fecha_hito) updateData.fecha_hito = new Date(input.fecha_hito);
		if (input.lugar !== undefined) updateData.lugar = input.lugar || null;
		if (input.id_ministro !== undefined) updateData.id_ministro = input.id_ministro ? parseInt(String(input.id_ministro)) : null;
		if (input.observaciones !== undefined) updateData.observaciones = input.observaciones || null;
		if (input.documento_url !== undefined) updateData.documento_url = input.documento_url || null;

		const hito = await prisma.historialEspiritual.update({
			where: { id_hito: id },
			data: updateData,
			include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, tipoHito: true },
		});
		return sendResponse(res, ApiResponse.updated(hito, "Hito espiritual actualizado correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al actualizar hito espiritual", error));
	}
});

// DELETE hito (eliminación física: no tiene estado)
router.delete("/:id", authenticateToken, requirePermission("espiritual", "eliminar"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) {
			return sendResponse(res, ApiResponse.validationError("ID inválido"));
		}
		const congregacionFilter = getCongregacionFilter(req.user);
		const existing = await prisma.historialEspiritual.findFirst({ where: { id_hito: id, miembro: { ...congregacionFilter } } });
		if (!existing) {
			return sendResponse(res, ApiResponse.notFound("Hito no encontrado"));
		}
		await prisma.historialEspiritual.delete({ where: { id_hito: id } });
		return sendResponse(res, ApiResponse.deleted("Hito espiritual eliminado correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al eliminar hito espiritual", error));
	}
});

export default router;
