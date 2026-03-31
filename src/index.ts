import dotenv from "dotenv";
dotenv.config();

import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import prisma from "./config/db";

// Rutas
import authRoutes from "./routes/auth";
import miembroRoutes from "./routes/miembros";
import congregacionRoutes from "./routes/congregaciones";
import eventoRoutes from "./routes/eventos";
import finanzasRoutes from "./routes/finanzas";
import usuarioRoutes from "./routes/usuarios";
import inventarioRoutes from "./routes/inventario";
import institucionRoutes from "./routes/instituciones";

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API directa para miembros inactivos - SE DEBE COLOCAR ANTES del router de miembros
// porque Express匹配路由顺序
app.get("/api/miembros-inactivos", async (req: Request, res: Response) => {
	try {
		console.log("=== /api/miembros-inactivos called ===");
		const miembros = await prisma.miembro.findMany({ 
			where: { id_estado: 6 }, // Solo inactivos
			take: 100,
			include: {
				estado: true,
				congregacion: true,
				tipoMiembro: true
			}
		});
		res.json(miembros);
	} catch (error) {
		console.error("Error getting inactive members:", error);
		res.status(500).json({ error: "Error al obtener miembros inactivos" });
	}
});

// Rutas - IMPORTANTE: miembroRoutes debe ir DESPUÉS de las rutas específicas
app.use("/api/auth", authRoutes);
app.use("/api/miembros", miembroRoutes);
app.use("/api/congregaciones", congregacionRoutes);
app.use("/api/eventos", eventoRoutes);
app.use("/api/finanzas", finanzasRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/inventario", inventarioRoutes);
app.use("/api/instituciones", institucionRoutes);

// Health check
app.get("/health", (req: Request, res: Response) => {
	res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// DEBUG route - sin middleware
app.get("/debug/miembros", (req: Request, res: Response) => {
	console.log("=== DEBUG /debug/miembros called ===");
	res.json({ message: "DEBUG route works" });
});

// API directa para miembros inactivos - sin /api/ para evitar conflicto con router
app.get("/debug/miembros-inactivos", async (req: Request, res: Response) => {
	try {
		console.log("=== /debug/miembros-inactivos called ===");
		const miembros = await prisma.miembro.findMany({ 
			where: { id_estado: 6 }, // Solo inactivos
			take: 100,
			include: {
				estado: true,
				congregacion: true,
				tipoMiembro: true
			}
		});
		res.json(miembros);
	} catch (error) {
		console.error("Error getting inactive members:", error);
		res.status(500).json({ error: "Error al obtener miembros inactivos" });
	}
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error("Error:", err.message);
	res.status(500).json({ error: "Error interno del servidor" });
});

// 404 handler
app.use((req: Request, res: Response) => {
	res.status(404).json({ error: "Ruta no encontrada" });
});

async function main() {
	try {
		await prisma.$connect();
		console.log("Database connected");

		app.listen(PORT, () => {
			console.log(`Server running on port ${PORT}`);
		});
	} catch (error) {
		console.error("Failed to connect to database:", error);
		process.exit(1);
	}
}

main();

export default app;
