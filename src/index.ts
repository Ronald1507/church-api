import dotenv from "dotenv";
dotenv.config();

import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import prisma from "./config/db";
import { ApiResponse } from "./utils/response";

// Rutas
import authRoutes from "./routes/auth";
import miembroRoutes from "./routes/miembros";
import congregacionRoutes from "./routes/congregaciones";
import eventoRoutes from "./routes/eventos";
import finanzasRoutes from "./routes/finanzas";
import usuarioRoutes from "./routes/usuarios";
import inventarioRoutes from "./routes/inventario";
import institucionRoutes from "./routes/instituciones";
import estadoRoutes from "./routes/estados";
import familiaRoutes from "./routes/familia";
import espiritualRoutes from "./routes/espiritual";
import pastoralRoutes from "./routes/pastoral";
import comunicacionRoutes from "./routes/comunicaciones";
import documentoRoutes from "./routes/documentos";
import auditoriaRoutes from "./routes/auditoria";

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/miembros", miembroRoutes);
app.use("/api/congregaciones", congregacionRoutes);
app.use("/api/eventos", eventoRoutes);
app.use("/api/finanzas", finanzasRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/inventario", inventarioRoutes);
app.use("/api/instituciones", institucionRoutes);
app.use("/api/estados", estadoRoutes);
app.use("/api/familia", familiaRoutes);
app.use("/api/espiritual", espiritualRoutes);
app.use("/api/pastoral", pastoralRoutes);
app.use("/api/comunicaciones", comunicacionRoutes);
app.use("/api/documentos", documentoRoutes);
app.use("/api/auditoria", auditoriaRoutes);

// Health check
app.get("/health", (req: Request, res: Response) => {
	res.json(ApiResponse.success({ status: "ok", timestamp: new Date().toISOString() }));
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error("Error:", err.message);
	const response = ApiResponse.error("Error interno del servidor", err.message);
	res.status(response.statusCode).json(response);
});

// 404 handler - usar ApiResponse
app.use((req: Request, res: Response) => {
	const response = ApiResponse.notFound("Ruta no encontrada");
	res.status(response.statusCode).json(response);
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