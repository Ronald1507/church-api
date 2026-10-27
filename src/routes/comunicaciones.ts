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
router.get("/listado/estados", authenticateToken, requirePermission("comunicaciones", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const estados = await prisma.estado.findMany({ where: { entidad: "COMUNICACION" }, orderBy: { nombre: "asc" } });
		return sendResponse(res, ApiResponse.success(estados));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener estados", error));
	}
});

router.get("/listado/instituciones", authenticateToken, requirePermission("comunicaciones", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const congregacionFilter = getCongregacionFilter(req.user);
		const instituciones = await prisma.institucion.findMany({
			where: { ...congregacionFilter },
			select: { id_institucion: true, nombre: true, tipo: true },
			orderBy: { nombre: "asc" },
		});
		return sendResponse(res, ApiResponse.success(instituciones));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener instituciones", error));
	}
});

// ============================================
// CRUD COMUNICACIONES
// ============================================
router.get("/", authenticateToken, requirePermission("comunicaciones", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const congregacionFilter = getCongregacionFilter(req.user);
		const comunicaciones = await prisma.comunicacion.findMany({
			where: { ...congregacionFilter },
			take: 200,
			include: { congregacion: true, institucion: true, estado: true },
			orderBy: { created_at: "desc" },
		});
		return sendResponse(res, ApiResponse.success(comunicaciones));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener comunicaciones", error));
	}
});

router.get("/:id", authenticateToken, requirePermission("comunicaciones", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) return sendResponse(res, ApiResponse.validationError("ID inválido"));
		const congregacionFilter = getCongregacionFilter(req.user);
		const comunicacion = await prisma.comunicacion.findFirst({
			where: { id_comunicacion: id, ...congregacionFilter },
			include: { congregacion: true, institucion: true, estado: true },
		});
		if (!comunicacion) return sendResponse(res, ApiResponse.notFound("Comunicación no encontrada"));
		return sendResponse(res, ApiResponse.success(comunicacion));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener comunicación", error));
	}
});

router.post("/", authenticateToken, requirePermission("comunicaciones", "crear"), async (req: AuthRequest, res: Response) => {
	try {
		const { asunto, mensaje, canal, destinatario_tipo, id_institucion, id_estado } = req.body;
		if (!asunto || !mensaje || !canal || !destinatario_tipo) {
			return sendResponse(res, ApiResponse.validationError("Faltan campos requeridos"));
		}

		// Congregación: admin puede especificar; usuario usa la suya
		const { nivel } = req.user || {};
		let id_congregacion: number | null = null;
		if ((nivel === "ADMIN" || nivel === "SUPERADMIN") && req.body.id_congregacion) {
			id_congregacion = parseInt(String(req.body.id_congregacion));
		} else if (req.user?.id_congregacion) {
			id_congregacion = req.user.id_congregacion;
		}

		let estadoId = id_estado ? parseInt(String(id_estado)) : null;
		if (!estadoId) {
			const estadoBorrador = await getEstadoByCodigo("COMUNICACION", "BORRADOR");
			if (!estadoBorrador) return sendResponse(res, ApiResponse.error("Estado 'BORRADOR' no encontrado. Ejecute el seed de estados."));
			estadoId = estadoBorrador.id_estado;
		}

		const comunicacion = await prisma.comunicacion.create({
			data: {
				asunto,
				mensaje,
				canal,
				destinatario_tipo,
				id_congregacion,
				id_institucion: id_institucion ? parseInt(String(id_institucion)) : null,
				id_enviado_por: req.user!.userId,
				id_estado: estadoId,
			},
			include: { congregacion: true, institucion: true, estado: true },
		});
		return sendResponse(res, ApiResponse.created(comunicacion, "Comunicación creada correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al crear comunicación", error));
	}
});

router.put("/:id", authenticateToken, requirePermission("comunicaciones", "actualizar"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) return sendResponse(res, ApiResponse.validationError("ID inválido"));
		const congregacionFilter = getCongregacionFilter(req.user);
		const existing = await prisma.comunicacion.findFirst({ where: { id_comunicacion: id, ...congregacionFilter } });
		if (!existing) return sendResponse(res, ApiResponse.notFound("Comunicación no encontrada"));

		const input = req.body;
		const updateData: Record<string, unknown> = {};
		if (input.asunto !== undefined) updateData.asunto = input.asunto;
		if (input.mensaje !== undefined) updateData.mensaje = input.mensaje;
		if (input.canal !== undefined) updateData.canal = input.canal;
		if (input.destinatario_tipo !== undefined) updateData.destinatario_tipo = input.destinatario_tipo;
		if (input.id_institucion !== undefined) updateData.id_institucion = input.id_institucion ? parseInt(String(input.id_institucion)) : null;
		if (input.id_estado !== undefined && input.id_estado) updateData.id_estado = parseInt(String(input.id_estado));

		const comunicacion = await prisma.comunicacion.update({
			where: { id_comunicacion: id },
			data: updateData,
			include: { congregacion: true, institucion: true, estado: true },
		});
		return sendResponse(res, ApiResponse.updated(comunicacion, "Comunicación actualizada correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al actualizar comunicación", error));
	}
});

// PATCH marcar como enviada
router.patch("/:id/enviar", authenticateToken, requirePermission("comunicaciones", "actualizar"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) return sendResponse(res, ApiResponse.validationError("ID inválido"));
		const congregacionFilter = getCongregacionFilter(req.user);
		const existing = await prisma.comunicacion.findFirst({ where: { id_comunicacion: id, ...congregacionFilter } });
		if (!existing) return sendResponse(res, ApiResponse.notFound("Comunicación no encontrada"));

		const estadoEnviada = await getEstadoByCodigo("COMUNICACION", "ENVIADA");
		if (!estadoEnviada) return sendResponse(res, ApiResponse.error("Estado 'ENVIADA' no encontrado"));

		const comunicacion = await prisma.comunicacion.update({
			where: { id_comunicacion: id },
			data: { id_estado: estadoEnviada.id_estado, fecha_envio: new Date() },
			include: { congregacion: true, institucion: true, estado: true },
		});
		return sendResponse(res, ApiResponse.success(comunicacion, "Comunicación marcada como enviada"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al enviar comunicación", error));
	}
});

router.delete("/:id", authenticateToken, requirePermission("comunicaciones", "eliminar"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) return sendResponse(res, ApiResponse.validationError("ID inválido"));
		const congregacionFilter = getCongregacionFilter(req.user);
		const existing = await prisma.comunicacion.findFirst({ where: { id_comunicacion: id, ...congregacionFilter } });
		if (!existing) return sendResponse(res, ApiResponse.notFound("Comunicación no encontrada"));

		const estadoAnulada = await getEstadoByCodigo("COMUNICACION", "ANULADA");
		if (!estadoAnulada) return sendResponse(res, ApiResponse.error("Estado 'ANULADA' no encontrado"));

		await prisma.comunicacion.update({ where: { id_comunicacion: id }, data: { id_estado: estadoAnulada.id_estado } });
		return sendResponse(res, ApiResponse.deleted("Comunicación anulada correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al anular comunicación", error));
	}
});

export default router;
