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

const getNumericId = (param: string | string[]): number | null => {
	const value = Array.isArray(param) ? param[0] : param;
	const num = parseInt(value);
	return isNaN(num) ? null : num;
};

// ============================================
// LISTADOS
// ============================================
router.get("/listado/estados", authenticateToken, requirePermission("documentos", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const estados = await prisma.estado.findMany({ where: { entidad: "DOCUMENTO" }, orderBy: { nombre: "asc" } });
		return sendResponse(res, ApiResponse.success(estados));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener estados", error));
	}
});

router.get("/listado/miembros", authenticateToken, requirePermission("documentos", "leer"), async (req: AuthRequest, res: Response) => {
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
// CRUD DOCUMENTOS
// ============================================
router.get("/", authenticateToken, requirePermission("documentos", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const congregacionFilter = getCongregacionFilter(req.user);
		const documentos = await prisma.documento.findMany({
			where: { miembro: { ...congregacionFilter } },
			take: 200,
			include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
			orderBy: { fecha_emision: "desc" },
		});
		return sendResponse(res, ApiResponse.success(documentos));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener documentos", error));
	}
});

router.get("/miembro/:idMiembro", authenticateToken, requirePermission("documentos", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const idMiembro = getNumericId(req.params.idMiembro);
		if (idMiembro === null) return sendResponse(res, ApiResponse.validationError("ID de miembro inválido"));
		const congregacionFilter = getCongregacionFilter(req.user);
		const miembro = await prisma.miembro.findFirst({ where: { id_miembro: idMiembro, ...congregacionFilter } });
		if (!miembro) return sendResponse(res, ApiResponse.notFound("Miembro no encontrado"));
		const documentos = await prisma.documento.findMany({
			where: { id_miembro: idMiembro },
			include: { estado: true },
			orderBy: { fecha_emision: "desc" },
		});
		return sendResponse(res, ApiResponse.success(documentos));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener documentos del miembro", error));
	}
});

router.get("/:id", authenticateToken, requirePermission("documentos", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) return sendResponse(res, ApiResponse.validationError("ID inválido"));
		const congregacionFilter = getCongregacionFilter(req.user);
		const documento = await prisma.documento.findFirst({
			where: { id_documento: id, miembro: { ...congregacionFilter } },
			include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
		});
		if (!documento) return sendResponse(res, ApiResponse.notFound("Documento no encontrado"));
		return sendResponse(res, ApiResponse.success(documento));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener documento", error));
	}
});

router.post("/", authenticateToken, requirePermission("documentos", "crear"), async (req: AuthRequest, res: Response) => {
	try {
		const { id_miembro, tipo_documento, numero_serie, fecha_emision, archivo_url, id_estado } = req.body;
		if (!id_miembro || !tipo_documento) {
			return sendResponse(res, ApiResponse.validationError("Faltan campos requeridos"));
		}

		const congregacionFilter = getCongregacionFilter(req.user);
		const miembro = await prisma.miembro.findFirst({ where: { id_miembro: parseInt(String(id_miembro)), ...congregacionFilter } });
		if (!miembro) return sendResponse(res, ApiResponse.notFound("Miembro no encontrado o no accesible"));

		let estadoId = id_estado ? parseInt(String(id_estado)) : null;
		if (!estadoId) {
			const estadoVigente = await getEstadoByCodigo("DOCUMENTO", "VIGENTE");
			if (!estadoVigente) return sendResponse(res, ApiResponse.error("Estado 'VIGENTE' no encontrado. Ejecute el seed de estados."));
			estadoId = estadoVigente.id_estado;
		}

		const documento = await prisma.documento.create({
			data: {
				id_miembro: parseInt(String(id_miembro)),
				tipo_documento,
				numero_serie: numero_serie || null,
				fecha_emision: fecha_emision ? new Date(fecha_emision) : new Date(),
				id_emitido_por: req.user!.userId,
				archivo_url: archivo_url || null,
				id_estado: estadoId,
			},
			include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
		});
		return sendResponse(res, ApiResponse.created(documento, "Documento creado correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al crear documento", error));
	}
});

router.put("/:id", authenticateToken, requirePermission("documentos", "actualizar"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) return sendResponse(res, ApiResponse.validationError("ID inválido"));
		const congregacionFilter = getCongregacionFilter(req.user);
		const existing = await prisma.documento.findFirst({ where: { id_documento: id, miembro: { ...congregacionFilter } } });
		if (!existing) return sendResponse(res, ApiResponse.notFound("Documento no encontrado"));

		const input = req.body;
		const updateData: Record<string, unknown> = {};
		if (input.tipo_documento !== undefined) updateData.tipo_documento = input.tipo_documento;
		if (input.numero_serie !== undefined) updateData.numero_serie = input.numero_serie || null;
		if (input.fecha_emision !== undefined && input.fecha_emision) updateData.fecha_emision = new Date(input.fecha_emision);
		if (input.archivo_url !== undefined) updateData.archivo_url = input.archivo_url || null;
		if (input.id_estado !== undefined && input.id_estado) updateData.id_estado = parseInt(String(input.id_estado));

		const documento = await prisma.documento.update({
			where: { id_documento: id },
			data: updateData,
			include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
		});
		return sendResponse(res, ApiResponse.updated(documento, "Documento actualizado correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al actualizar documento", error));
	}
});

router.delete("/:id", authenticateToken, requirePermission("documentos", "eliminar"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) return sendResponse(res, ApiResponse.validationError("ID inválido"));
		const congregacionFilter = getCongregacionFilter(req.user);
		const existing = await prisma.documento.findFirst({ where: { id_documento: id, miembro: { ...congregacionFilter } } });
		if (!existing) return sendResponse(res, ApiResponse.notFound("Documento no encontrado"));

		const estadoAnulado = await getEstadoByCodigo("DOCUMENTO", "ANULADO");
		if (!estadoAnulado) return sendResponse(res, ApiResponse.error("Estado 'ANULADO' no encontrado"));

		await prisma.documento.update({ where: { id_documento: id }, data: { id_estado: estadoAnulado.id_estado } });
		return sendResponse(res, ApiResponse.deleted("Documento anulado correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al anular documento", error));
	}
});

export default router;
