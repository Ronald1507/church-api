-- CreateTable
CREATE TABLE "estado" (
    "id_estado" SERIAL NOT NULL,
    "entidad" VARCHAR(60) NOT NULL,
    "codigo" VARCHAR(30) NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" TEXT,
    "color_hex" CHAR(7),
    "es_estado_final" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estado_pkey" PRIMARY KEY ("id_estado")
);

-- CreateTable
CREATE TABLE "rol_sistema" (
    "id_rol" SERIAL NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "descripcion" TEXT,
    "permisos" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_sistema_pkey" PRIMARY KEY ("id_rol")
);

-- CreateTable
CREATE TABLE "usuario_sistema" (
    "id_usuario" SERIAL NOT NULL,
    "username" VARCHAR(60) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "id_rol" INTEGER NOT NULL,
    "id_estado" INTEGER NOT NULL,
    "ultimo_acceso" TIMESTAMPTZ,
    "id_miembro" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_sistema_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "tipo_miembro" (
    "id_tipo" SERIAL NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipo_miembro_pkey" PRIMARY KEY ("id_tipo")
);

-- CreateTable
CREATE TABLE "congregacion" (
    "id_congregacion" SERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "direccion" VARCHAR(200),
    "ciudad" VARCHAR(80),
    "region" VARCHAR(80),
    "id_pastor" INTEGER,
    "telefono" VARCHAR(20),
    "email" VARCHAR(120),
    "id_estado" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "congregacion_pkey" PRIMARY KEY ("id_congregacion")
);

-- CreateTable
CREATE TABLE "ministerio" (
    "id_ministerio" SERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" TEXT,
    "id_lider" INTEGER,
    "id_congregacion" INTEGER NOT NULL,
    "id_estado" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ministerio_pkey" PRIMARY KEY ("id_ministerio")
);

-- CreateTable
CREATE TABLE "miembro" (
    "id_miembro" SERIAL NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos" VARCHAR(100) NOT NULL,
    "fecha_nacimiento" DATE,
    "genero" CHAR(1),
    "estado_civil" VARCHAR(20),
    "rut" VARCHAR(12),
    "telefono" VARCHAR(20),
    "email" VARCHAR(120),
    "direccion" VARCHAR(200),
    "foto_url" VARCHAR(300),
    "fecha_ingreso" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_estado" INTEGER NOT NULL,
    "id_congregacion" INTEGER NOT NULL,
    "id_ministerio" INTEGER,
    "id_tipo_miembro" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "miembro_pkey" PRIMARY KEY ("id_miembro")
);

-- CreateTable
CREATE TABLE "cargo_ministerial" (
    "id_cargo" SERIAL NOT NULL,
    "id_miembro" INTEGER NOT NULL,
    "id_ministerio" INTEGER NOT NULL,
    "cargo" VARCHAR(80) NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "id_estado" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargo_ministerial_pkey" PRIMARY KEY ("id_cargo")
);

-- CreateTable
CREATE TABLE "tipo_relacion_familiar" (
    "id_tipo" SERIAL NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "nombre_inverso" VARCHAR(60) NOT NULL,
    "es_simetrica" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipo_relacion_familiar_pkey" PRIMARY KEY ("id_tipo")
);

-- CreateTable
CREATE TABLE "relacion_familiar" (
    "id" SERIAL NOT NULL,
    "id_miembro_origen" INTEGER NOT NULL,
    "id_miembro_destino" INTEGER NOT NULL,
    "id_tipo_relacion" INTEGER NOT NULL,
    "fecha_registro" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relacion_familiar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_hito" (
    "id_tipo_hito" SERIAL NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" TEXT,
    "requiere_ministro" BOOLEAN NOT NULL DEFAULT true,
    "genera_documento" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipo_hito_pkey" PRIMARY KEY ("id_tipo_hito")
);

-- CreateTable
CREATE TABLE "historial_espiritual" (
    "id_hito" SERIAL NOT NULL,
    "id_miembro" INTEGER NOT NULL,
    "id_tipo_hito" INTEGER NOT NULL,
    "fecha_hito" DATE NOT NULL,
    "lugar" VARCHAR(150),
    "id_ministro" INTEGER,
    "observaciones" TEXT,
    "documento_url" VARCHAR(300),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_espiritual_pkey" PRIMARY KEY ("id_hito")
);

-- CreateTable
CREATE TABLE "visita_pastoral" (
    "id_visita" SERIAL NOT NULL,
    "id_miembro" INTEGER NOT NULL,
    "id_pastor" INTEGER NOT NULL,
    "fecha_visita" DATE NOT NULL,
    "motivo" VARCHAR(200) NOT NULL,
    "observaciones" TEXT,
    "resultado" TEXT,
    "id_estado" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visita_pastoral_pkey" PRIMARY KEY ("id_visita")
);

-- CreateTable
CREATE TABLE "peticion_oracion" (
    "id_peticion" SERIAL NOT NULL,
    "id_miembro" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" VARCHAR(60),
    "privacidad" VARCHAR(20) NOT NULL DEFAULT 'privada',
    "id_estado" INTEGER NOT NULL,
    "fecha_solicitud" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_cierre" DATE,
    "testimonio" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "peticion_oracion_pkey" PRIMARY KEY ("id_peticion")
);

-- CreateTable
CREATE TABLE "institucion" (
    "id_institucion" SERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "tipo" VARCHAR(60),
    "descripcion" TEXT,
    "id_congregacion" INTEGER NOT NULL,
    "id_estado" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institucion_pkey" PRIMARY KEY ("id_institucion")
);

-- CreateTable
CREATE TABLE "miembro_institucion" (
    "id" SERIAL NOT NULL,
    "id_miembro" INTEGER NOT NULL,
    "id_institucion" INTEGER NOT NULL,
    "rol" VARCHAR(80),
    "fecha_ingreso" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_estado" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "miembro_institucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento" (
    "id_evento" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "tipo" VARCHAR(60),
    "descripcion" TEXT,
    "fecha_inicio" TIMESTAMPTZ NOT NULL,
    "fecha_fin" TIMESTAMPTZ,
    "lugar" VARCHAR(200),
    "id_congregacion" INTEGER NOT NULL,
    "capacidad_max" INTEGER,
    "id_estado" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_pkey" PRIMARY KEY ("id_evento")
);

-- CreateTable
CREATE TABLE "asistencia_evento" (
    "id" SERIAL NOT NULL,
    "id_evento" INTEGER NOT NULL,
    "id_miembro" INTEGER NOT NULL,
    "hora_registro" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo_registro" VARCHAR(20) NOT NULL DEFAULT 'presencial',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asistencia_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finanza_cuenta" (
    "id_cuenta" SERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "descripcion" TEXT,
    "saldo_actual" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "id_congregacion" INTEGER NOT NULL,
    "id_estado" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finanza_cuenta_pkey" PRIMARY KEY ("id_cuenta")
);

-- CreateTable
CREATE TABLE "transaccion" (
    "id_transaccion" SERIAL NOT NULL,
    "id_cuenta" INTEGER NOT NULL,
    "tipo" VARCHAR(10) NOT NULL,
    "concepto" VARCHAR(200) NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metodo_pago" VARCHAR(30),
    "id_registrado_por" INTEGER NOT NULL,
    "comprobante_url" VARCHAR(300),
    "id_estado" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaccion_pkey" PRIMARY KEY ("id_transaccion")
);

-- CreateTable
CREATE TABLE "ofrenda_dizmo" (
    "id_ofrenda" SERIAL NOT NULL,
    "id_miembro" INTEGER NOT NULL,
    "id_transaccion" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(65,30) NOT NULL,
    "sobre_numero" VARCHAR(20),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ofrenda_dizmo_pkey" PRIMARY KEY ("id_ofrenda")
);

-- CreateTable
CREATE TABLE "presupuesto" (
    "id_presupuesto" SERIAL NOT NULL,
    "id_congregacion" INTEGER NOT NULL,
    "anio" SMALLINT NOT NULL,
    "mes" SMALLINT NOT NULL,
    "categoria" VARCHAR(80) NOT NULL,
    "monto_asignado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "monto_ejecutado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presupuesto_pkey" PRIMARY KEY ("id_presupuesto")
);

-- CreateTable
CREATE TABLE "inventario_item" (
    "id_item" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "categoria" VARCHAR(80),
    "descripcion" TEXT,
    "codigo" VARCHAR(40),
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "unidad_medida" VARCHAR(20) NOT NULL DEFAULT 'unidad',
    "valor_unitario" DECIMAL(65,30),
    "ubicacion" VARCHAR(100),
    "id_estado" INTEGER NOT NULL,
    "id_congregacion" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventario_item_pkey" PRIMARY KEY ("id_item")
);

-- CreateTable
CREATE TABLE "movimiento_inventario" (
    "id_movimiento" SERIAL NOT NULL,
    "id_item" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_responsable" INTEGER NOT NULL,
    "motivo" VARCHAR(200),
    "documento_ref" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_inventario_pkey" PRIMARY KEY ("id_movimiento")
);

-- CreateTable
CREATE TABLE "prestamo_inventario" (
    "id_prestamo" SERIAL NOT NULL,
    "id_item" INTEGER NOT NULL,
    "id_ministerio" INTEGER,
    "fecha_prestamo" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_devolucion_esperada" DATE NOT NULL,
    "fecha_devolucion_real" DATE,
    "id_estado" INTEGER NOT NULL,
    "observaciones" TEXT,
    "id_responsable" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prestamo_inventario_pkey" PRIMARY KEY ("id_prestamo")
);

-- CreateTable
CREATE TABLE "comunicacion" (
    "id_comunicacion" SERIAL NOT NULL,
    "asunto" VARCHAR(200) NOT NULL,
    "mensaje" TEXT NOT NULL,
    "canal" VARCHAR(20) NOT NULL,
    "destinatario_tipo" VARCHAR(20) NOT NULL,
    "id_congregacion" INTEGER,
    "id_ministerio" INTEGER,
    "id_enviado_por" INTEGER NOT NULL,
    "fecha_envio" TIMESTAMPTZ,
    "id_estado" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comunicacion_pkey" PRIMARY KEY ("id_comunicacion")
);

-- CreateTable
CREATE TABLE "documento" (
    "id_documento" SERIAL NOT NULL,
    "id_miembro" INTEGER NOT NULL,
    "tipo_documento" VARCHAR(60) NOT NULL,
    "numero_serie" VARCHAR(40),
    "fecha_emision" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_emitido_por" INTEGER NOT NULL,
    "archivo_url" VARCHAR(300),
    "id_estado" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id_documento")
);

-- CreateTable
CREATE TABLE "auditoria_log" (
    "id_log" BIGSERIAL NOT NULL,
    "id_usuario" INTEGER,
    "tabla_afectada" VARCHAR(60) NOT NULL,
    "accion" VARCHAR(10) NOT NULL,
    "id_registro" INTEGER,
    "datos_anteriores" JSONB,
    "datos_nuevos" JSONB,
    "fecha_hora" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_origen" INET,

    CONSTRAINT "auditoria_log_pkey" PRIMARY KEY ("id_log")
);

-- CreateIndex
CREATE UNIQUE INDEX "estado_entidad_codigo_key" ON "estado"("entidad", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "rol_sistema_nombre_key" ON "rol_sistema"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_sistema_username_key" ON "usuario_sistema"("username");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_sistema_email_key" ON "usuario_sistema"("email");

-- CreateIndex
CREATE INDEX "usuario_sistema_id_rol_idx" ON "usuario_sistema"("id_rol");

-- CreateIndex
CREATE INDEX "usuario_sistema_id_estado_idx" ON "usuario_sistema"("id_estado");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_miembro_nombre_key" ON "tipo_miembro"("nombre");

-- CreateIndex
CREATE INDEX "ministerio_id_congregacion_idx" ON "ministerio"("id_congregacion");

-- CreateIndex
CREATE INDEX "ministerio_id_estado_idx" ON "ministerio"("id_estado");

-- CreateIndex
CREATE UNIQUE INDEX "miembro_rut_key" ON "miembro"("rut");

-- CreateIndex
CREATE INDEX "miembro_id_congregacion_idx" ON "miembro"("id_congregacion");

-- CreateIndex
CREATE INDEX "miembro_id_ministerio_idx" ON "miembro"("id_ministerio");

-- CreateIndex
CREATE INDEX "miembro_id_estado_idx" ON "miembro"("id_estado");

-- CreateIndex
CREATE INDEX "cargo_ministerial_id_miembro_idx" ON "cargo_ministerial"("id_miembro");

-- CreateIndex
CREATE INDEX "cargo_ministerial_id_ministerio_idx" ON "cargo_ministerial"("id_ministerio");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_relacion_familiar_nombre_key" ON "tipo_relacion_familiar"("nombre");

-- CreateIndex
CREATE INDEX "relacion_familiar_id_miembro_origen_idx" ON "relacion_familiar"("id_miembro_origen");

-- CreateIndex
CREATE INDEX "relacion_familiar_id_miembro_destino_idx" ON "relacion_familiar"("id_miembro_destino");

-- CreateIndex
CREATE UNIQUE INDEX "relacion_familiar_id_miembro_origen_id_miembro_destino_id_t_key" ON "relacion_familiar"("id_miembro_origen", "id_miembro_destino", "id_tipo_relacion");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_hito_nombre_key" ON "tipo_hito"("nombre");

-- CreateIndex
CREATE INDEX "historial_espiritual_id_miembro_idx" ON "historial_espiritual"("id_miembro");

-- CreateIndex
CREATE INDEX "historial_espiritual_id_tipo_hito_idx" ON "historial_espiritual"("id_tipo_hito");

-- CreateIndex
CREATE INDEX "visita_pastoral_id_miembro_idx" ON "visita_pastoral"("id_miembro");

-- CreateIndex
CREATE INDEX "visita_pastoral_id_pastor_idx" ON "visita_pastoral"("id_pastor");

-- CreateIndex
CREATE INDEX "visita_pastoral_fecha_visita_idx" ON "visita_pastoral"("fecha_visita");

-- CreateIndex
CREATE INDEX "peticion_oracion_id_miembro_idx" ON "peticion_oracion"("id_miembro");

-- CreateIndex
CREATE INDEX "peticion_oracion_id_estado_idx" ON "peticion_oracion"("id_estado");

-- CreateIndex
CREATE INDEX "institucion_id_congregacion_idx" ON "institucion"("id_congregacion");

-- CreateIndex
CREATE INDEX "miembro_institucion_id_miembro_idx" ON "miembro_institucion"("id_miembro");

-- CreateIndex
CREATE INDEX "miembro_institucion_id_institucion_idx" ON "miembro_institucion"("id_institucion");

-- CreateIndex
CREATE UNIQUE INDEX "miembro_institucion_id_miembro_id_institucion_key" ON "miembro_institucion"("id_miembro", "id_institucion");

-- CreateIndex
CREATE INDEX "evento_id_congregacion_idx" ON "evento"("id_congregacion");

-- CreateIndex
CREATE INDEX "evento_fecha_inicio_idx" ON "evento"("fecha_inicio");

-- CreateIndex
CREATE INDEX "evento_id_estado_idx" ON "evento"("id_estado");

-- CreateIndex
CREATE INDEX "asistencia_evento_id_evento_idx" ON "asistencia_evento"("id_evento");

-- CreateIndex
CREATE INDEX "asistencia_evento_id_miembro_idx" ON "asistencia_evento"("id_miembro");

-- CreateIndex
CREATE UNIQUE INDEX "asistencia_evento_id_evento_id_miembro_key" ON "asistencia_evento"("id_evento", "id_miembro");

-- CreateIndex
CREATE INDEX "finanza_cuenta_id_congregacion_idx" ON "finanza_cuenta"("id_congregacion");

-- CreateIndex
CREATE INDEX "transaccion_id_cuenta_idx" ON "transaccion"("id_cuenta");

-- CreateIndex
CREATE INDEX "transaccion_fecha_idx" ON "transaccion"("fecha");

-- CreateIndex
CREATE INDEX "transaccion_id_estado_idx" ON "transaccion"("id_estado");

-- CreateIndex
CREATE INDEX "ofrenda_dizmo_id_miembro_idx" ON "ofrenda_dizmo"("id_miembro");

-- CreateIndex
CREATE INDEX "ofrenda_dizmo_id_transaccion_idx" ON "ofrenda_dizmo"("id_transaccion");

-- CreateIndex
CREATE INDEX "presupuesto_id_congregacion_anio_mes_idx" ON "presupuesto"("id_congregacion", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "presupuesto_id_congregacion_anio_mes_categoria_key" ON "presupuesto"("id_congregacion", "anio", "mes", "categoria");

-- CreateIndex
CREATE UNIQUE INDEX "inventario_item_codigo_key" ON "inventario_item"("codigo");

-- CreateIndex
CREATE INDEX "inventario_item_id_congregacion_idx" ON "inventario_item"("id_congregacion");

-- CreateIndex
CREATE INDEX "inventario_item_categoria_idx" ON "inventario_item"("categoria");

-- CreateIndex
CREATE INDEX "movimiento_inventario_id_item_idx" ON "movimiento_inventario"("id_item");

-- CreateIndex
CREATE INDEX "movimiento_inventario_fecha_idx" ON "movimiento_inventario"("fecha");

-- CreateIndex
CREATE INDEX "prestamo_inventario_id_item_idx" ON "prestamo_inventario"("id_item");

-- CreateIndex
CREATE INDEX "prestamo_inventario_id_estado_idx" ON "prestamo_inventario"("id_estado");

-- CreateIndex
CREATE INDEX "comunicacion_id_estado_idx" ON "comunicacion"("id_estado");

-- CreateIndex
CREATE UNIQUE INDEX "documento_numero_serie_key" ON "documento"("numero_serie");

-- CreateIndex
CREATE INDEX "documento_id_miembro_idx" ON "documento"("id_miembro");

-- CreateIndex
CREATE INDEX "documento_tipo_documento_idx" ON "documento"("tipo_documento");

-- CreateIndex
CREATE INDEX "auditoria_log_id_usuario_idx" ON "auditoria_log"("id_usuario");

-- CreateIndex
CREATE INDEX "auditoria_log_tabla_afectada_idx" ON "auditoria_log"("tabla_afectada");

-- CreateIndex
CREATE INDEX "auditoria_log_fecha_hora_idx" ON "auditoria_log"("fecha_hora");

-- AddForeignKey
ALTER TABLE "usuario_sistema" ADD CONSTRAINT "usuario_sistema_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "rol_sistema"("id_rol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_sistema" ADD CONSTRAINT "usuario_sistema_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "congregacion" ADD CONSTRAINT "congregacion_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ministerio" ADD CONSTRAINT "ministerio_id_congregacion_fkey" FOREIGN KEY ("id_congregacion") REFERENCES "congregacion"("id_congregacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ministerio" ADD CONSTRAINT "ministerio_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro" ADD CONSTRAINT "miembro_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro" ADD CONSTRAINT "miembro_id_congregacion_fkey" FOREIGN KEY ("id_congregacion") REFERENCES "congregacion"("id_congregacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro" ADD CONSTRAINT "miembro_id_tipo_miembro_fkey" FOREIGN KEY ("id_tipo_miembro") REFERENCES "tipo_miembro"("id_tipo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro" ADD CONSTRAINT "miembro_id_ministerio_fkey" FOREIGN KEY ("id_ministerio") REFERENCES "ministerio"("id_ministerio") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_ministerial" ADD CONSTRAINT "cargo_ministerial_id_miembro_fkey" FOREIGN KEY ("id_miembro") REFERENCES "miembro"("id_miembro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_ministerial" ADD CONSTRAINT "cargo_ministerial_id_ministerio_fkey" FOREIGN KEY ("id_ministerio") REFERENCES "ministerio"("id_ministerio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_ministerial" ADD CONSTRAINT "cargo_ministerial_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relacion_familiar" ADD CONSTRAINT "relacion_familiar_id_miembro_origen_fkey" FOREIGN KEY ("id_miembro_origen") REFERENCES "miembro"("id_miembro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relacion_familiar" ADD CONSTRAINT "relacion_familiar_id_miembro_destino_fkey" FOREIGN KEY ("id_miembro_destino") REFERENCES "miembro"("id_miembro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relacion_familiar" ADD CONSTRAINT "relacion_familiar_id_tipo_relacion_fkey" FOREIGN KEY ("id_tipo_relacion") REFERENCES "tipo_relacion_familiar"("id_tipo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_espiritual" ADD CONSTRAINT "historial_espiritual_id_miembro_fkey" FOREIGN KEY ("id_miembro") REFERENCES "miembro"("id_miembro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_espiritual" ADD CONSTRAINT "historial_espiritual_id_tipo_hito_fkey" FOREIGN KEY ("id_tipo_hito") REFERENCES "tipo_hito"("id_tipo_hito") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visita_pastoral" ADD CONSTRAINT "visita_pastoral_id_miembro_fkey" FOREIGN KEY ("id_miembro") REFERENCES "miembro"("id_miembro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visita_pastoral" ADD CONSTRAINT "visita_pastoral_id_pastor_fkey" FOREIGN KEY ("id_pastor") REFERENCES "miembro"("id_miembro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visita_pastoral" ADD CONSTRAINT "visita_pastoral_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peticion_oracion" ADD CONSTRAINT "peticion_oracion_id_miembro_fkey" FOREIGN KEY ("id_miembro") REFERENCES "miembro"("id_miembro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peticion_oracion" ADD CONSTRAINT "peticion_oracion_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institucion" ADD CONSTRAINT "institucion_id_congregacion_fkey" FOREIGN KEY ("id_congregacion") REFERENCES "congregacion"("id_congregacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institucion" ADD CONSTRAINT "institucion_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro_institucion" ADD CONSTRAINT "miembro_institucion_id_miembro_fkey" FOREIGN KEY ("id_miembro") REFERENCES "miembro"("id_miembro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro_institucion" ADD CONSTRAINT "miembro_institucion_id_institucion_fkey" FOREIGN KEY ("id_institucion") REFERENCES "institucion"("id_institucion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro_institucion" ADD CONSTRAINT "miembro_institucion_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_id_congregacion_fkey" FOREIGN KEY ("id_congregacion") REFERENCES "congregacion"("id_congregacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_evento" ADD CONSTRAINT "asistencia_evento_id_evento_fkey" FOREIGN KEY ("id_evento") REFERENCES "evento"("id_evento") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_evento" ADD CONSTRAINT "asistencia_evento_id_miembro_fkey" FOREIGN KEY ("id_miembro") REFERENCES "miembro"("id_miembro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finanza_cuenta" ADD CONSTRAINT "finanza_cuenta_id_congregacion_fkey" FOREIGN KEY ("id_congregacion") REFERENCES "congregacion"("id_congregacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finanza_cuenta" ADD CONSTRAINT "finanza_cuenta_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaccion" ADD CONSTRAINT "transaccion_id_cuenta_fkey" FOREIGN KEY ("id_cuenta") REFERENCES "finanza_cuenta"("id_cuenta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaccion" ADD CONSTRAINT "transaccion_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofrenda_dizmo" ADD CONSTRAINT "ofrenda_dizmo_id_miembro_fkey" FOREIGN KEY ("id_miembro") REFERENCES "miembro"("id_miembro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofrenda_dizmo" ADD CONSTRAINT "ofrenda_dizmo_id_transaccion_fkey" FOREIGN KEY ("id_transaccion") REFERENCES "transaccion"("id_transaccion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuesto" ADD CONSTRAINT "presupuesto_id_congregacion_fkey" FOREIGN KEY ("id_congregacion") REFERENCES "congregacion"("id_congregacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_item" ADD CONSTRAINT "inventario_item_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_item" ADD CONSTRAINT "inventario_item_id_congregacion_fkey" FOREIGN KEY ("id_congregacion") REFERENCES "congregacion"("id_congregacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_id_item_fkey" FOREIGN KEY ("id_item") REFERENCES "inventario_item"("id_item") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamo_inventario" ADD CONSTRAINT "prestamo_inventario_id_item_fkey" FOREIGN KEY ("id_item") REFERENCES "inventario_item"("id_item") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamo_inventario" ADD CONSTRAINT "prestamo_inventario_id_ministerio_fkey" FOREIGN KEY ("id_ministerio") REFERENCES "ministerio"("id_ministerio") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamo_inventario" ADD CONSTRAINT "prestamo_inventario_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicacion" ADD CONSTRAINT "comunicacion_id_congregacion_fkey" FOREIGN KEY ("id_congregacion") REFERENCES "congregacion"("id_congregacion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicacion" ADD CONSTRAINT "comunicacion_id_ministerio_fkey" FOREIGN KEY ("id_ministerio") REFERENCES "ministerio"("id_ministerio") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicacion" ADD CONSTRAINT "comunicacion_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_id_miembro_fkey" FOREIGN KEY ("id_miembro") REFERENCES "miembro"("id_miembro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;
