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

// Rutas
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
