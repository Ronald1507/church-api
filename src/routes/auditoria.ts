import { Router, Request, Response } from "express";
import prisma from "../config/db";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { ApiResponse, sendResponse } from "../utils/response";

const router = Router();

const getNumericId = (param: string | string[]): number | null => {
	const value = Array.isArray(param) ? param[0] : param;
	const num = parseInt(value);
	return isNaN(num) ? null : num;
};

// El id_log es BigInt — no serializable a JSON por defecto. Se convierte a string.
const serializeLog = (log: Record<string, unknown> & { id_log: bigint }) => ({
	...log,
	id_log: log.id_log.toString(),
});

// ============================================
// AUDITORÍA (solo lectura — ADMIN/SUPERADMIN)
// ============================================

// GET log de auditoría con filtros opcionales: tabla, accion, id_usuario, limit
router.get("/", authenticateToken, requirePermission("auditoria", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const { tabla, accion, id_usuario } = req.query;
		const limitParam = getNumericId((req.query.limit as string) || "100");
		const take = limitParam && limitParam > 0 && limitParam <= 500 ? limitParam : 100;

		const where: Record<string, unknown> = {};
		if (tabla) where.tabla_afectada = String(tabla);
		if (accion) where.accion = String(accion);
		if (id_usuario) {
			const uid = getNumericId(String(id_usuario));
			if (uid !== null) where.id_usuario = uid;
		}

		const logs = await prisma.auditoriaLog.findMany({
			where,
			take,
			orderBy: { fecha_hora: "desc" },
		});

		return sendResponse(res, ApiResponse.success(logs.map(serializeLog)));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener log de auditoría", error));
	}
});

// GET tablas distintas presentes en el log (para filtros)
router.get("/listado/tablas", authenticateToken, requirePermission("auditoria", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const tablas = await prisma.auditoriaLog.findMany({
			distinct: ["tabla_afectada"],
			select: { tabla_afectada: true },
			orderBy: { tabla_afectada: "asc" },
		});
		return sendResponse(res, ApiResponse.success(tablas.map((t) => t.tabla_afectada)));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener tablas", error));
	}
});

// GET un registro de auditoría por ID
router.get("/:id", authenticateToken, requirePermission("auditoria", "leer"), async (req: AuthRequest, res: Response) => {
	try {
		const id = getNumericId(req.params.id);
		if (id === null) return sendResponse(res, ApiResponse.validationError("ID inválido"));
		const log = await prisma.auditoriaLog.findUnique({ where: { id_log: BigInt(id) } });
		if (!log) return sendResponse(res, ApiResponse.notFound("Registro de auditoría no encontrado"));
		return sendResponse(res, ApiResponse.success(serializeLog(log)));
	} catch (error) {
		return sendResponse(res, ApiResponse.error("Error al obtener registro de auditoría", error));
	}
});

export default router;
