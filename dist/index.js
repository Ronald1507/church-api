"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const db_1 = __importDefault(require("./config/db"));
// Rutas
const auth_1 = __importDefault(require("./routes/auth"));
const miembros_1 = __importDefault(require("./routes/miembros"));
const congregaciones_1 = __importDefault(require("./routes/congregaciones"));
const eventos_1 = __importDefault(require("./routes/eventos"));
const finanzas_1 = __importDefault(require("./routes/finanzas"));
const usuarios_1 = __importDefault(require("./routes/usuarios"));
const inventario_1 = __importDefault(require("./routes/inventario"));
const instituciones_1 = __importDefault(require("./routes/instituciones"));
const estados_1 = __importDefault(require("./routes/estados"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Rutas
app.use("/api/auth", auth_1.default);
app.use("/api/miembros", miembros_1.default);
app.use("/api/congregaciones", congregaciones_1.default);
app.use("/api/eventos", eventos_1.default);
app.use("/api/finanzas", finanzas_1.default);
app.use("/api/usuarios", usuarios_1.default);
app.use("/api/inventario", inventario_1.default);
app.use("/api/instituciones", instituciones_1.default);
app.use("/api/estados", estados_1.default);
// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error("Error:", err.message);
    res.status(500).json({ error: "Error interno del servidor" });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: "Ruta no encontrada" });
});
async function main() {
    try {
        await db_1.default.$connect();
        console.log("Database connected");
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error("Failed to connect to database:", error);
        process.exit(1);
    }
}
main();
exports.default = app;
//# sourceMappingURL=index.js.map