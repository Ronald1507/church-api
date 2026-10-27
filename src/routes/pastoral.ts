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
router.get("/listado/estados/visita", authenticateToken, requirePermission("pastoral", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const estados = await prisma.estado.findMany({ where: { entidad: "VISITA_PASTORAL" }, orderBy: { nombre: "asc" } });
		return sendResponse(res, ApiResponse.success(estados));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener estados de visita", error));
	}
});

router.get("/listado/estados/peticion", authenticateToken, requirePermission("pastoral", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const estados = await prisma.estado.findMany({ where: { entidad: "PETICION_ORACION" }, orderBy: { nombre: "asc" } });
		return sendResponse(res, ApiResponse.success(estados));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener estados de petición", error));
	}
});

router.get("/listado/miembros", authenticateToken, requirePermission("pastoral", "leer"), async (req: AuthRequest, res: Response) => {
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
// CRUD VISITAS PASTORALES
// ============================================
router.get("/visitas", authenticateToken, requirePermission("pastoral", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const congregacionFilter = getCongregacionFilter(req.user);
		const visitas = await prisma.visitaPastoral.findMany({
			where: { miembro: { ...congregacionFilter } },
			take: 200,
			include: {
				miembro: { select: { id_miembro: true, nombres: true, apellidos: true } },
				pastor: { select: { id_miembro: true, nombres: true, apellidos: true } },
				estado: true,
			},
			orderBy: { fecha_visita: "desc" },
		});
		return sendResponse(res, ApiResponse.success(visitas));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener visitas pastorales", error));
	}
});

router.get("/visitas/:id", authenticateToken, requirePermission("pastoral", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) return sendResponse(res, ApiResponse.validationError("ID inválido"));
		const congregacionFilter = getCongregacionFilter(req.user);
		const visita = await prisma.visitaPastoral.findFirst({
			where: { id_visita: id, miembro: { ...congregacionFilter } },
			include: {
				miembro: { select: { id_miembro: true, nombres: true, apellidos: true } },
				pastor: { select: { id_miembro: true, nombres: true, apellidos: true } },
				estado: true,
			},
		});
		if (!visita) return sendResponse(res, ApiResponse.notFound("Visita no encontrada"));
		return sendResponse(res, ApiResponse.success(visita));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener visita", error));
	}
});

router.post("/visitas", authenticateToken, requirePermission("pastoral", "crear"), async (req: AuthRequest, res: Response) => {
	try {
		const { id_miembro, id_pastor, fecha_visita, motivo, observaciones, resultado, id_estado } = req.body;
		if (!id_miembro || !id_pastor || !fecha_visita || !motivo) {
			return sendResponse(res, ApiResponse.validationError("Faltan campos requeridos"));
		}

		const congregacionFilter = getCongregacionFilter(req.user);
		const miembro = await prisma.miembro.findFirst({ where: { id_miembro: parseInt(String(id_miembro)), ...congregacionFilter } });
		if (!miembro) return sendResponse(res, ApiResponse.notFound("Miembro no encontrado o no accesible"));

		let estadoId = id_estado ? parseInt(String(id_estado)) : null;
		if (!estadoId) {
			const estadoProgramada = await getEstadoByCodigo("VISITA_PASTORAL", "PROGRAMADA");
			if (!estadoProgramada) return sendResponse(res, ApiResponse.error("Estado 'PROGRAMADA' no encontrado. Ejecute el seed de estados."));
			estadoId = estadoProgramada.id_estado;
		}

		const visita = await prisma.visitaPastoral.create({
			data: {
				id_miembro: parseInt(String(id_miembro)),
				id_pastor: parseInt(String(id_pastor)),
				fecha_visita: new Date(fecha_visita),
				motivo,
				observaciones: observaciones || null,
				resultado: resultado || null,
				id_estado: estadoId,
			},
			include: {
				miembro: { select: { id_miembro: true, nombres: true, apellidos: true } },
				pastor: { select: { id_miembro: true, nombres: true, apellidos: true } },
				estado: true,
			},
		});
		return sendResponse(res, ApiResponse.created(visita, "Visita pastoral registrada correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al registrar visita pastoral", error));
	}
});

router.put("/visitas/:id", authenticateToken, requirePermission("pastoral", "actualizar"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) return sendResponse(res, ApiResponse.validationError("ID inválido"));
		const congregacionFilter = getCongregacionFilter(req.user);
		const existing = await prisma.visitaPastoral.findFirst({ where: { id_visita: id, miembro: { ...congregacionFilter } } });
		if (!existing) return sendResponse(res, ApiResponse.notFound("Visita no encontrada"));

		const input = req.body;
		const updateData: Record<string, unknown> = {};
		if (input.id_pastor !== undefined) updateData.id_pastor = parseInt(String(input.id_pastor));
		if (input.fecha_visita !== undefined && input.fecha_visita) updateData.fecha_visita = new Date(input.fecha_visita);
		if (input.motivo !== undefined) updateData.motivo = input.motivo;
		if (input.observaciones !== undefined) updateData.observaciones = input.observaciones || null;
		if (input.resultado !== undefined) updateData.resultado = input.resultado || null;
		if (input.id_estado !== undefined && input.id_estado) updateData.id_estado = parseInt(String(input.id_estado));

		const visita = await prisma.visitaPastoral.update({
			where: { id_visita: id },
			data: updateData,
			include: {
				miembro: { select: { id_miembro: true, nombres: true, apellidos: true } },
				pastor: { select: { id_miembro: true, nombres: true, apellidos: true } },
				estado: true,
			},
		});
		return sendResponse(res, ApiResponse.updated(visita, "Visita pastoral actualizada correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al actualizar visita pastoral", error));
	}
});

router.delete("/visitas/:id", authenticateToken, requirePermission("pastoral", "eliminar"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) return sendResponse(res, ApiResponse.validationError("ID inválido"));
		const congregacionFilter = getCongregacionFilter(req.user);
		const existing = await prisma.visitaPastoral.findFirst({ where: { id_visita: id, miembro: { ...congregacionFilter } } });
		if (!existing) return sendResponse(res, ApiResponse.notFound("Visita no encontrada"));

		const estadoCancelada = await getEstadoByCodigo("VISITA_PASTORAL", "CANCELADA");
		if (!estadoCancelada) return sendResponse(res, ApiResponse.error("Estado 'CANCELADA' no encontrado"));

		await prisma.visitaPastoral.update({ where: { id_visita: id }, data: { id_estado: estadoCancelada.id_estado } });
		return sendResponse(res, ApiResponse.deleted("Visita pastoral cancelada correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al cancelar visita pastoral", error));
	}
});

// ============================================
// CRUD PETICIONES DE ORACIÓN
// ============================================
router.get("/peticiones", authenticateToken, requirePermission("pastoral", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const congregacionFilter = getCongregacionFilter(req.user);
		const peticiones = await prisma.peticionOracion.findMany({
			where: { miembro: { ...congregacionFilter } },
			take: 200,
			include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
			orderBy: { fecha_solicitud: "desc" },
		});
		return sendResponse(res, ApiResponse.success(peticiones));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener peticiones de oración", error));
	}
});

router.get("/peticiones/:id", authenticateToken, requirePermission("pastoral", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) return sendResponse(res, ApiResponse.validationError("ID inválido"));
		const congregacionFilter = getCongregacionFilter(req.user);
		const peticion = await prisma.peticionOracion.findFirst({
			where: { id_peticion: id, miembro: { ...congregacionFilter } },
			include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
		});
		if (!peticion) return sendResponse(res, ApiResponse.notFound("Petición no encontrada"));
		return sendResponse(res, ApiResponse.success(peticion));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener petición", error));
	}
});

router.post("/peticiones", authenticateToken, requirePermission("pastoral", "crear"), async (req: AuthRequest, res: Response) => {
	try {
		const { id_miembro, descripcion, categoria, privacidad, id_estado } = req.body;
		if (!id_miembro || !descripcion) {
			return sendResponse(res, ApiResponse.validationError("Faltan campos requeridos"));
		}

		const congregacionFilter = getCongregacionFilter(req.user);
		const miembro = await prisma.miembro.findFirst({ where: { id_miembro: parseInt(String(id_miembro)), ...congregacionFilter } });
		if (!miembro) return sendResponse(res, ApiResponse.notFound("Miembro no encontrado o no accesible"));

		let estadoId = id_estado ? parseInt(String(id_estado)) : null;
		if (!estadoId) {
			const estadoActiva = await getEstadoByCodigo("PETICION_ORACION", "ACTIVA");
			if (!estadoActiva) return sendResponse(res, ApiResponse.error("Estado 'ACTIVA' no encontrado. Ejecute el seed de estados."));
			estadoId = estadoActiva.id_estado;
		}

		const peticion = await prisma.peticionOracion.create({
			data: {
				id_miembro: parseInt(String(id_miembro)),
				descripcion,
				categoria: categoria || null,
				privacidad: privacidad || "privada",
				id_estado: estadoId,
			},
			include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
		});
		return sendResponse(res, ApiResponse.created(peticion, "Petición de oración registrada correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al registrar petición de oración", error));
	}
});

router.put("/peticiones/:id", authenticateToken, requirePermission("pastoral", "actualizar"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) return sendResponse(res, ApiResponse.validationError("ID inválido"));
		const congregacionFilter = getCongregacionFilter(req.user);
		const existing = await prisma.peticionOracion.findFirst({ where: { id_peticion: id, miembro: { ...congregacionFilter } } });
		if (!existing) return sendResponse(res, ApiResponse.notFound("Petición no encontrada"));

		const input = req.body;
		const updateData: Record<string, unknown> = {};
		if (input.descripcion !== undefined) updateData.descripcion = input.descripcion;
		if (input.categoria !== undefined) updateData.categoria = input.categoria || null;
		if (input.privacidad !== undefined) updateData.privacidad = input.privacidad;
		if (input.testimonio !== undefined) updateData.testimonio = input.testimonio || null;
		if (input.fecha_cierre !== undefined) updateData.fecha_cierre = input.fecha_cierre ? new Date(input.fecha_cierre) : null;
		if (input.id_estado !== undefined && input.id_estado) updateData.id_estado = parseInt(String(input.id_estado));

		const peticion = await prisma.peticionOracion.update({
			where: { id_peticion: id },
			data: updateData,
			include: { miembro: { select: { id_miembro: true, nombres: true, apellidos: true } }, estado: true },
		});
		return sendResponse(res, ApiResponse.updated(peticion, "Petición de oración actualizada correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al actualizar petición de oración", error));
	}
});

router.delete("/peticiones/:id", authenticateToken, requirePermission("pastoral", "eliminar"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) return sendResponse(res, ApiResponse.validationError("ID inválido"));
		const congregacionFilter = getCongregacionFilter(req.user);
		const existing = await prisma.peticionOracion.findFirst({ where: { id_peticion: id, miembro: { ...congregacionFilter } } });
		if (!existing) return sendResponse(res, ApiResponse.notFound("Petición no encontrada"));

		const estadoCerrada = await getEstadoByCodigo("PETICION_ORACION", "CERRADA");
		if (!estadoCerrada) return sendResponse(res, ApiResponse.error("Estado 'CERRADA' no encontrado"));

		await prisma.peticionOracion.update({
			where: { id_peticion: id },
			data: { id_estado: estadoCerrada.id_estado, fecha_cierre: new Date() },
		});
		return sendResponse(res, ApiResponse.deleted("Petición de oración cerrada correctamente"));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al cerrar petición de oración", error));
	}
});

export default router;
