-- =============================================================
--  SISTEMA DE GESTIÓN - IGLESIA PENTECOSTAL EVANGÉLICA
--  Base de datos: PostgreSQL 15+
--  Versión: 3.0 (modelo refinado)
--  Generado por: Claude / Anthropic
-- =============================================================

-- Activar extensión para UUIDs opcionales y timestamps automáticos
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
--  FUNCIÓN AUXILIAR: updated_at automático
-- =============================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Macro para crear trigger de updated_at en cualquier tabla
-- Uso: SELECT fn_add_updated_at_trigger('nombre_tabla');
CREATE OR REPLACE FUNCTION fn_add_updated_at_trigger(p_table TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER trg_%s_updated_at
     BEFORE UPDATE ON %I
     FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()',
    p_table, p_table
  );
END;
$$ LANGUAGE plpgsql;


-- =============================================================
--  1. SISTEMA DE ESTADOS CENTRALIZADO
-- =============================================================
CREATE TABLE estado (
  id_estado         SERIAL PRIMARY KEY,
  entidad           VARCHAR(60)  NOT NULL,          -- ej: 'MIEMBRO', 'TRANSACCION'
  codigo            VARCHAR(30)  NOT NULL,           -- ej: 'ACTIVO', 'ANULADO'
  nombre            VARCHAR(80)  NOT NULL,
  descripcion       TEXT,
  color_hex         CHAR(7)      DEFAULT '#888888',  -- para badges en UI
  es_estado_final   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (entidad, codigo)
);
SELECT fn_add_updated_at_trigger('estado');

-- Datos base de estados por entidad
INSERT INTO estado (entidad, codigo, nombre, color_hex, es_estado_final) VALUES
  -- Miembro
  ('MIEMBRO',              'ACTIVO',       'Activo',             '#22c55e', FALSE),
  ('MIEMBRO',              'INACTIVO',     'Inactivo',           '#f59e0b', FALSE),
  ('MIEMBRO',              'ANULADO',      'Anulado',            '#ef4444', TRUE),
  ('MIEMBRO',              'VISITA',       'Visita',             '#3b82f6', FALSE),
  -- Congregación
  ('CONGREGACION',         'ACTIVA',       'Activa',             '#22c55e', FALSE),
  ('CONGREGACION',         'INACTIVA',     'Inactiva',           '#f59e0b', TRUE),
  -- Ministerio
  ('MINISTERIO',           'ACTIVO',       'Activo',             '#22c55e', FALSE),
  ('MINISTERIO',           'DISUELTO',     'Disuelto',           '#ef4444', TRUE),
  -- Cargo ministerial
  ('CARGO_MINISTERIAL',    'ACTIVO',       'Activo',             '#22c55e', FALSE),
  ('CARGO_MINISTERIAL',    'FINALIZADO',   'Finalizado',         '#6b7280', TRUE),
  -- Institución
  ('INSTITUCION',          'ACTIVA',       'Activa',             '#22c55e', FALSE),
  ('INSTITUCION',          'INACTIVA',     'Inactiva',           '#f59e0b', TRUE),
  -- Evento
  ('EVENTO',               'PLANIFICADO',  'Planificado',        '#3b82f6', FALSE),
  ('EVENTO',               'EN_CURSO',     'En curso',           '#22c55e', FALSE),
  ('EVENTO',               'FINALIZADO',   'Finalizado',         '#6b7280', TRUE),
  ('EVENTO',               'CANCELADO',    'Cancelado',          '#ef4444', TRUE),
  -- Transacción
  ('TRANSACCION',          'CONFIRMADA',   'Confirmada',         '#22c55e', FALSE),
  ('TRANSACCION',          'PENDIENTE',    'Pendiente',          '#f59e0b', FALSE),
  ('TRANSACCION',          'ANULADA',      'Anulada',            '#ef4444', TRUE),
  -- Cuenta financiera
  ('FINANZA_CUENTA',       'ACTIVA',       'Activa',             '#22c55e', FALSE),
  ('FINANZA_CUENTA',       'CERRADA',      'Cerrada',            '#6b7280', TRUE),
  -- Inventario
  ('INVENTARIO_ITEM',      'DISPONIBLE',   'Disponible',         '#22c55e', FALSE),
  ('INVENTARIO_ITEM',      'EN_PRESTAMO',  'En préstamo',        '#f59e0b', FALSE),
  ('INVENTARIO_ITEM',      'EN_REPARACION','En reparación',      '#f59e0b', FALSE),
  ('INVENTARIO_ITEM',      'DADO_DE_BAJA', 'Dado de baja',       '#ef4444', TRUE),
  -- Préstamo de inventario
  ('PRESTAMO_INVENTARIO',  'ACTIVO',       'Activo',             '#3b82f6', FALSE),
  ('PRESTAMO_INVENTARIO',  'DEVUELTO',     'Devuelto',           '#22c55e', TRUE),
  ('PRESTAMO_INVENTARIO',  'CON_RETRASO',  'Con retraso',        '#ef4444', FALSE),
  -- Petición de oración
  ('PETICION_ORACION',     'ACTIVA',       'Activa',             '#3b82f6', FALSE),
  ('PETICION_ORACION',     'RESPONDIDA',   'Respondida',         '#22c55e', TRUE),
  ('PETICION_ORACION',     'CERRADA',      'Cerrada',            '#6b7280', TRUE),
  -- Visita pastoral
  ('VISITA_PASTORAL',      'REALIZADA',    'Realizada',          '#22c55e', TRUE),
  ('VISITA_PASTORAL',      'PENDIENTE',    'Pendiente',          '#f59e0b', FALSE),
  ('VISITA_PASTORAL',      'CANCELADA',    'Cancelada',          '#ef4444', TRUE),
  -- Documento
  ('DOCUMENTO',            'VIGENTE',      'Vigente',            '#22c55e', FALSE),
  ('DOCUMENTO',            'ANULADO',      'Anulado',            '#ef4444', TRUE),
  -- Comunicación
  ('COMUNICACION',         'ENVIADA',      'Enviada',            '#22c55e', TRUE),
  ('COMUNICACION',         'PROGRAMADA',   'Programada',         '#3b82f6', FALSE),
  ('COMUNICACION',         'FALLIDA',      'Fallida',            '#ef4444', TRUE),
  -- Usuario sistema
  ('USUARIO_SISTEMA',      'ACTIVO',       'Activo',             '#22c55e', FALSE),
  ('USUARIO_SISTEMA',      'BLOQUEADO',    'Bloqueado',          '#f59e0b', FALSE),
  ('USUARIO_SISTEMA',      'INACTIVO',     'Inactivo',           '#6b7280', TRUE),
  -- Miembro institución
  ('MIEMBRO_INSTITUCION',  'ACTIVO',       'Activo',             '#22c55e', FALSE),
  ('MIEMBRO_INSTITUCION',  'INACTIVO',     'Inactivo',           '#6b7280', TRUE);


-- =============================================================
--  2. MÓDULO SISTEMA: ROLES Y USUARIOS
-- =============================================================
CREATE TABLE rol_sistema (
  id_rol        SERIAL PRIMARY KEY,
  nombre        VARCHAR(60)  NOT NULL UNIQUE,
  descripcion   TEXT,
  permisos      JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('rol_sistema');

INSERT INTO rol_sistema (nombre, descripcion, permisos) VALUES
  ('Administrador',  'Acceso total al sistema',                  '{"*": true}'),
  ('Pastor',         'Gestión pastoral y reportes generales',     '{"miembros": true, "visitas": true, "eventos": true, "reportes": true}'),
  ('Tesorero',       'Gestión financiera y presupuesto',          '{"finanzas": true, "presupuesto": true, "reportes_financieros": true}'),
  ('Secretaria',     'Registro de miembros y eventos',            '{"miembros": true, "eventos": true, "documentos": true}'),
  ('Líder',          'Gestión de su ministerio o institución',    '{"ministerio_propio": true, "asistencia": true}');

CREATE TABLE usuario_sistema (
  id_usuario      SERIAL PRIMARY KEY,
  username        VARCHAR(60)   NOT NULL UNIQUE,
  password_hash   VARCHAR(255)  NOT NULL,
  email           VARCHAR(120)  NOT NULL UNIQUE,
  id_rol          INT           NOT NULL REFERENCES rol_sistema(id_rol),
  id_estado       INT           NOT NULL REFERENCES estado(id_estado),
  ultimo_acceso   TIMESTAMPTZ,
  id_miembro      INT,                                -- FK diferida (miembro se crea después)
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('usuario_sistema');
CREATE INDEX idx_usuario_rol     ON usuario_sistema(id_rol);
CREATE INDEX idx_usuario_estado  ON usuario_sistema(id_estado);


-- =============================================================
--  3. MÓDULO MEMBRESÍA
-- =============================================================
CREATE TABLE tipo_miembro (
  id_tipo       SERIAL PRIMARY KEY,
  nombre        VARCHAR(60)  NOT NULL UNIQUE,  -- ej: 'Miembro activo', 'Adherente', 'Visita'
  descripcion   TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('tipo_miembro');

INSERT INTO tipo_miembro (nombre, descripcion) VALUES
  ('Miembro activo',  'Miembro bautizado y comprometido con la congregación'),
  ('Adherente',       'Participa regularmente pero sin membresía formal'),
  ('Visita',          'Asistente ocasional'),
  ('Niño/Joven',      'Menor de edad bajo cuidado de la congregación');

CREATE TABLE congregacion (
  id_congregacion   SERIAL PRIMARY KEY,
  nombre            VARCHAR(120) NOT NULL,
  direccion         VARCHAR(200),
  ciudad            VARCHAR(80),
  region            VARCHAR(80),
  id_pastor         INT,                              -- FK diferida
  telefono          VARCHAR(20),
  email             VARCHAR(120),
  id_estado         INT          NOT NULL REFERENCES estado(id_estado),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('congregacion');
CREATE INDEX idx_congregacion_estado ON congregacion(id_estado);

CREATE TABLE ministerio (
  id_ministerio   SERIAL PRIMARY KEY,
  nombre          VARCHAR(120) NOT NULL,
  descripcion     TEXT,
  id_lider        INT,                              -- FK diferida
  id_congregacion INT          NOT NULL REFERENCES congregacion(id_congregacion),
  id_estado       INT          NOT NULL REFERENCES estado(id_estado),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('ministerio');
CREATE INDEX idx_ministerio_congregacion ON ministerio(id_congregacion);
CREATE INDEX idx_ministerio_estado       ON ministerio(id_estado);

CREATE TABLE miembro (
  id_miembro        SERIAL PRIMARY KEY,
  nombres           VARCHAR(100) NOT NULL,
  apellidos         VARCHAR(100) NOT NULL,
  fecha_nacimiento  DATE,
  genero            CHAR(1)      CHECK (genero IN ('M','F','O')),
  estado_civil      VARCHAR(20)  CHECK (estado_civil IN ('soltero','casado','viudo','divorciado','separado')),
  rut               VARCHAR(12)  UNIQUE,
  telefono          VARCHAR(20),
  email             VARCHAR(120),
  direccion         VARCHAR(200),
  foto_url          VARCHAR(300),
  fecha_ingreso     DATE         NOT NULL DEFAULT CURRENT_DATE,
  id_estado         INT          NOT NULL REFERENCES estado(id_estado),
  id_congregacion   INT          NOT NULL REFERENCES congregacion(id_congregacion),
  id_ministerio     INT          REFERENCES ministerio(id_ministerio),
  id_tipo_miembro   INT          NOT NULL REFERENCES tipo_miembro(id_tipo),
  id_usuario        INT          REFERENCES usuario_sistema(id_usuario),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('miembro');
CREATE INDEX idx_miembro_congregacion ON miembro(id_congregacion);
CREATE INDEX idx_miembro_ministerio   ON miembro(id_ministerio);
CREATE INDEX idx_miembro_estado       ON miembro(id_estado);
CREATE INDEX idx_miembro_nombres      ON miembro(apellidos, nombres);

-- FK diferidas que requerían miembro para existir
ALTER TABLE congregacion      ADD CONSTRAINT fk_congregacion_pastor  FOREIGN KEY (id_pastor)  REFERENCES miembro(id_miembro);
ALTER TABLE ministerio        ADD CONSTRAINT fk_ministerio_lider     FOREIGN KEY (id_lider)   REFERENCES miembro(id_miembro);
ALTER TABLE usuario_sistema   ADD CONSTRAINT fk_usuario_miembro      FOREIGN KEY (id_miembro) REFERENCES miembro(id_miembro);

CREATE TABLE cargo_ministerial (
  id_cargo        SERIAL PRIMARY KEY,
  id_miembro      INT          NOT NULL REFERENCES miembro(id_miembro),
  id_ministerio   INT          NOT NULL REFERENCES ministerio(id_ministerio),
  cargo           VARCHAR(80)  NOT NULL,   -- ej: 'Director', 'Coordinador', 'Voluntario'
  fecha_inicio    DATE         NOT NULL,
  fecha_fin       DATE,
  id_estado       INT          NOT NULL REFERENCES estado(id_estado),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('cargo_ministerial');
CREATE INDEX idx_cargo_miembro    ON cargo_ministerial(id_miembro);
CREATE INDEX idx_cargo_ministerio ON cargo_ministerial(id_ministerio);


-- =============================================================
--  4. MÓDULO FAMILIA
-- =============================================================
CREATE TABLE tipo_relacion_familiar (
  id_tipo         SERIAL PRIMARY KEY,
  nombre          VARCHAR(60)  NOT NULL UNIQUE,   -- ej: 'padre', 'cónyuge', 'hermano'
  nombre_inverso  VARCHAR(60)  NOT NULL,           -- ej: 'hijo',  'cónyuge', 'hermano'
  es_simetrica    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO tipo_relacion_familiar (nombre, nombre_inverso, es_simetrica) VALUES
  ('padre',    'hijo',    FALSE),
  ('madre',    'hijo',    FALSE),
  ('cónyuge',  'cónyuge', TRUE),
  ('hermano',  'hermano', TRUE),
  ('abuelo',   'nieto',   FALSE),
  ('tutor',    'pupilo',  FALSE);

CREATE TABLE relacion_familiar (
  id                SERIAL PRIMARY KEY,
  id_miembro_origen INT  NOT NULL REFERENCES miembro(id_miembro),
  id_miembro_destino INT NOT NULL REFERENCES miembro(id_miembro),
  id_tipo_relacion  INT  NOT NULL REFERENCES tipo_relacion_familiar(id_tipo),
  fecha_registro    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_no_autorrelacion CHECK (id_miembro_origen <> id_miembro_destino),
  UNIQUE (id_miembro_origen, id_miembro_destino, id_tipo_relacion)
);
CREATE INDEX idx_relacion_origen  ON relacion_familiar(id_miembro_origen);
CREATE INDEX idx_relacion_destino ON relacion_familiar(id_miembro_destino);


-- =============================================================
--  5. MÓDULO ESPIRITUAL
-- =============================================================
CREATE TABLE tipo_hito (
  id_tipo_hito        SERIAL PRIMARY KEY,
  nombre              VARCHAR(80)  NOT NULL UNIQUE,  -- ej: 'Bautismo en agua'
  descripcion         TEXT,
  requiere_ministro   BOOLEAN      NOT NULL DEFAULT TRUE,
  genera_documento    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('tipo_hito');

INSERT INTO tipo_hito (nombre, descripcion, requiere_ministro, genera_documento) VALUES
  ('Bautismo en agua',             'Bautismo por inmersión',                       TRUE,  TRUE),
  ('Bautismo en el Espíritu Santo','Experiencia del bautismo espiritual',           FALSE, FALSE),
  ('Presentación de niño',         'Dedicación de bebé o niño a Dios',             TRUE,  TRUE),
  ('Matrimonio eclesiástico',      'Ceremonia matrimonial realizada en la iglesia', TRUE,  TRUE),
  ('Confirmación de membresía',    'Ingreso formal como miembro activo',            TRUE,  TRUE),
  ('Consagración ministerial',     'Ordenación o consagración a un cargo',          TRUE,  TRUE);

CREATE TABLE historial_espiritual (
  id_hito         SERIAL PRIMARY KEY,
  id_miembro      INT          NOT NULL REFERENCES miembro(id_miembro),
  id_tipo_hito    INT          NOT NULL REFERENCES tipo_hito(id_tipo_hito),
  fecha_hito      DATE         NOT NULL,
  lugar           VARCHAR(150),
  id_ministro     INT          REFERENCES miembro(id_miembro),
  observaciones   TEXT,
  documento_url   VARCHAR(300),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('historial_espiritual');
CREATE INDEX idx_hito_miembro    ON historial_espiritual(id_miembro);
CREATE INDEX idx_hito_tipo       ON historial_espiritual(id_tipo_hito);


-- =============================================================
--  6. MÓDULO PASTORAL
-- =============================================================
CREATE TABLE visita_pastoral (
  id_visita       SERIAL PRIMARY KEY,
  id_miembro      INT          NOT NULL REFERENCES miembro(id_miembro),
  id_pastor       INT          NOT NULL REFERENCES miembro(id_miembro),
  fecha_visita    DATE         NOT NULL,
  motivo          VARCHAR(200) NOT NULL,
  observaciones   TEXT,
  resultado       TEXT,
  id_estado       INT          NOT NULL REFERENCES estado(id_estado),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('visita_pastoral');
CREATE INDEX idx_visita_miembro ON visita_pastoral(id_miembro);
CREATE INDEX idx_visita_pastor  ON visita_pastoral(id_pastor);
CREATE INDEX idx_visita_fecha   ON visita_pastoral(fecha_visita);

CREATE TABLE peticion_oracion (
  id_peticion     SERIAL PRIMARY KEY,
  id_miembro      INT          NOT NULL REFERENCES miembro(id_miembro),
  descripcion     TEXT         NOT NULL,
  categoria       VARCHAR(60),   -- ej: 'Salud', 'Familia', 'Trabajo', 'Financiero'
  privacidad      VARCHAR(20)  NOT NULL DEFAULT 'privada' CHECK (privacidad IN ('publica','privada','liderazgo')),
  id_estado       INT          NOT NULL REFERENCES estado(id_estado),
  fecha_solicitud DATE         NOT NULL DEFAULT CURRENT_DATE,
  fecha_cierre    DATE,
  testimonio      TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('peticion_oracion');
CREATE INDEX idx_peticion_miembro ON peticion_oracion(id_miembro);
CREATE INDEX idx_peticion_estado  ON peticion_oracion(id_estado);


-- =============================================================
--  7. MÓDULO INSTITUCIONES
-- =============================================================
CREATE TABLE institucion (
  id_institucion  SERIAL PRIMARY KEY,
  nombre          VARCHAR(120) NOT NULL,
  tipo            VARCHAR(60),    -- ej: 'Escuela dominical', 'Grupo de jóvenes', 'Damas'
  descripcion     TEXT,
  id_congregacion INT          NOT NULL REFERENCES congregacion(id_congregacion),
  id_director     INT          REFERENCES miembro(id_miembro),
  id_estado       INT          NOT NULL REFERENCES estado(id_estado),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('institucion');
CREATE INDEX idx_institucion_congregacion ON institucion(id_congregacion);

CREATE TABLE miembro_institucion (
  id              SERIAL PRIMARY KEY,
  id_miembro      INT          NOT NULL REFERENCES miembro(id_miembro),
  id_institucion  INT          NOT NULL REFERENCES institucion(id_institucion),
  rol             VARCHAR(80),
  fecha_ingreso   DATE         NOT NULL DEFAULT CURRENT_DATE,
  id_estado       INT          NOT NULL REFERENCES estado(id_estado),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (id_miembro, id_institucion)
);
SELECT fn_add_updated_at_trigger('miembro_institucion');
CREATE INDEX idx_mi_miembro     ON miembro_institucion(id_miembro);
CREATE INDEX idx_mi_institucion ON miembro_institucion(id_institucion);


-- =============================================================
--  8. MÓDULO EVENTOS
-- =============================================================
CREATE TABLE evento (
  id_evento       SERIAL PRIMARY KEY,
  nombre          VARCHAR(150) NOT NULL,
  tipo            VARCHAR(60),    -- ej: 'Culto', 'Campaña', 'Retiro', 'Conferencia'
  descripcion     TEXT,
  fecha_inicio    TIMESTAMPTZ  NOT NULL,
  fecha_fin       TIMESTAMPTZ,
  lugar           VARCHAR(200),
  id_congregacion INT          NOT NULL REFERENCES congregacion(id_congregacion),
  id_responsable  INT          REFERENCES miembro(id_miembro),
  capacidad_max   INT,
  id_estado       INT          NOT NULL REFERENCES estado(id_estado),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('evento');
CREATE INDEX idx_evento_congregacion ON evento(id_congregacion);
CREATE INDEX idx_evento_fecha        ON evento(fecha_inicio);
CREATE INDEX idx_evento_estado       ON evento(id_estado);

CREATE TABLE asistencia_evento (
  id              SERIAL PRIMARY KEY,
  id_evento       INT          NOT NULL REFERENCES evento(id_evento),
  id_miembro      INT          NOT NULL REFERENCES miembro(id_miembro),
  hora_registro   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  tipo_registro   VARCHAR(20)  NOT NULL DEFAULT 'presencial' CHECK (tipo_registro IN ('presencial','virtual','tardanza')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (id_evento, id_miembro)
);
CREATE INDEX idx_asistencia_evento  ON asistencia_evento(id_evento);
CREATE INDEX idx_asistencia_miembro ON asistencia_evento(id_miembro);


-- =============================================================
--  9. MÓDULO ECONOMÍA
-- =============================================================
CREATE TABLE finanza_cuenta (
  id_cuenta       SERIAL PRIMARY KEY,
  nombre          VARCHAR(120) NOT NULL,
  tipo            VARCHAR(40)  NOT NULL CHECK (tipo IN ('general','diezmos','ofrendas','misiones','construccion','otro')),
  descripcion     TEXT,
  saldo_actual    NUMERIC(14,2) NOT NULL DEFAULT 0,
  id_congregacion INT           NOT NULL REFERENCES congregacion(id_congregacion),
  id_estado       INT           NOT NULL REFERENCES estado(id_estado),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('finanza_cuenta');
CREATE INDEX idx_cuenta_congregacion ON finanza_cuenta(id_congregacion);

CREATE TABLE transaccion (
  id_transaccion      SERIAL PRIMARY KEY,
  id_cuenta           INT            NOT NULL REFERENCES finanza_cuenta(id_cuenta),
  tipo                VARCHAR(10)    NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  concepto            VARCHAR(200)   NOT NULL,
  monto               NUMERIC(14,2)  NOT NULL CHECK (monto > 0),
  fecha               DATE           NOT NULL DEFAULT CURRENT_DATE,
  metodo_pago         VARCHAR(30)    CHECK (metodo_pago IN ('efectivo','transferencia','cheque','tarjeta','otro')),
  id_registrado_por   INT            NOT NULL REFERENCES miembro(id_miembro),
  comprobante_url     VARCHAR(300),
  id_estado           INT            NOT NULL REFERENCES estado(id_estado),
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('transaccion');
CREATE INDEX idx_transaccion_cuenta ON transaccion(id_cuenta);
CREATE INDEX idx_transaccion_fecha  ON transaccion(fecha);
CREATE INDEX idx_transaccion_estado ON transaccion(id_estado);

CREATE TABLE ofrenda_dizmo (
  id_ofrenda      SERIAL PRIMARY KEY,
  id_miembro      INT            NOT NULL REFERENCES miembro(id_miembro),
  id_transaccion  INT            NOT NULL REFERENCES transaccion(id_transaccion),
  tipo            VARCHAR(20)    NOT NULL CHECK (tipo IN ('diezmo','ofrenda','primicias','mision','otro')),
  fecha           DATE           NOT NULL DEFAULT CURRENT_DATE,
  monto           NUMERIC(14,2)  NOT NULL CHECK (monto > 0),
  sobre_numero    VARCHAR(20),
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ofrenda_miembro     ON ofrenda_dizmo(id_miembro);
CREATE INDEX idx_ofrenda_transaccion ON ofrenda_dizmo(id_transaccion);

CREATE TABLE presupuesto (
  id_presupuesto    SERIAL PRIMARY KEY,
  id_congregacion   INT            NOT NULL REFERENCES congregacion(id_congregacion),
  anio              SMALLINT       NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
  mes               SMALLINT       NOT NULL CHECK (mes BETWEEN 1 AND 12),
  categoria         VARCHAR(80)    NOT NULL,
  monto_asignado    NUMERIC(14,2)  NOT NULL DEFAULT 0,
  monto_ejecutado   NUMERIC(14,2)  NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (id_congregacion, anio, mes, categoria)
);
SELECT fn_add_updated_at_trigger('presupuesto');
CREATE INDEX idx_presupuesto_congregacion ON presupuesto(id_congregacion, anio, mes);


-- =============================================================
--  10. MÓDULO INVENTARIO
-- =============================================================
CREATE TABLE inventario_item (
  id_item         SERIAL PRIMARY KEY,
  nombre          VARCHAR(150) NOT NULL,
  categoria       VARCHAR(80),    -- ej: 'Instrumento', 'Mobiliario', 'Tecnología', 'Librería'
  descripcion     TEXT,
  codigo          VARCHAR(40)  UNIQUE,
  cantidad        INT          NOT NULL DEFAULT 1 CHECK (cantidad >= 0),
  unidad_medida   VARCHAR(20)  NOT NULL DEFAULT 'unidad',
  valor_unitario  NUMERIC(12,2),
  ubicacion       VARCHAR(100),
  id_estado       INT          NOT NULL REFERENCES estado(id_estado),
  id_congregacion INT          NOT NULL REFERENCES congregacion(id_congregacion),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('inventario_item');
CREATE INDEX idx_item_congregacion ON inventario_item(id_congregacion);
CREATE INDEX idx_item_categoria    ON inventario_item(categoria);

CREATE TABLE movimiento_inventario (
  id_movimiento   SERIAL PRIMARY KEY,
  id_item         INT          NOT NULL REFERENCES inventario_item(id_item),
  tipo            VARCHAR(20)  NOT NULL CHECK (tipo IN ('entrada','salida','ajuste','baja')),
  cantidad        INT          NOT NULL,
  fecha           DATE         NOT NULL DEFAULT CURRENT_DATE,
  id_responsable  INT          NOT NULL REFERENCES miembro(id_miembro),
  motivo          VARCHAR(200),
  documento_ref   VARCHAR(100),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_movimiento_item  ON movimiento_inventario(id_item);
CREATE INDEX idx_movimiento_fecha ON movimiento_inventario(fecha);

CREATE TABLE prestamo_inventario (
  id_prestamo               SERIAL PRIMARY KEY,
  id_item                   INT          NOT NULL REFERENCES inventario_item(id_item),
  id_miembro                INT          REFERENCES miembro(id_miembro),
  id_ministerio             INT          REFERENCES ministerio(id_ministerio),
  fecha_prestamo            DATE         NOT NULL DEFAULT CURRENT_DATE,
  fecha_devolucion_esperada DATE         NOT NULL,
  fecha_devolucion_real     DATE,
  id_estado                 INT          NOT NULL REFERENCES estado(id_estado),
  observaciones             TEXT,
  id_responsable            INT          NOT NULL REFERENCES miembro(id_miembro),
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_prestamo_destino CHECK (id_miembro IS NOT NULL OR id_ministerio IS NOT NULL)
);
SELECT fn_add_updated_at_trigger('prestamo_inventario');
CREATE INDEX idx_prestamo_item    ON prestamo_inventario(id_item);
CREATE INDEX idx_prestamo_estado  ON prestamo_inventario(id_estado);


-- =============================================================
--  11. MÓDULO COMUNICACIONES Y DOCUMENTOS
-- =============================================================
CREATE TABLE comunicacion (
  id_comunicacion   SERIAL PRIMARY KEY,
  asunto            VARCHAR(200) NOT NULL,
  mensaje           TEXT         NOT NULL,
  canal             VARCHAR(20)  NOT NULL CHECK (canal IN ('email','whatsapp','sms','interno')),
  destinatario_tipo VARCHAR(20)  NOT NULL CHECK (destinatario_tipo IN ('congregacion','ministerio','institucion','individual')),
  id_congregacion   INT          REFERENCES congregacion(id_congregacion),
  id_ministerio     INT          REFERENCES ministerio(id_ministerio),
  id_enviado_por    INT          NOT NULL REFERENCES miembro(id_miembro),
  fecha_envio       TIMESTAMPTZ,
  id_estado         INT          NOT NULL REFERENCES estado(id_estado),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('comunicacion');
CREATE INDEX idx_comunicacion_estado ON comunicacion(id_estado);

CREATE TABLE documento (
  id_documento    SERIAL PRIMARY KEY,
  id_miembro      INT          NOT NULL REFERENCES miembro(id_miembro),
  tipo_documento  VARCHAR(60)  NOT NULL,  -- ej: 'Certificado de membresía', 'Certificado de bautismo'
  numero_serie    VARCHAR(40)  UNIQUE,
  fecha_emision   DATE         NOT NULL DEFAULT CURRENT_DATE,
  id_emitido_por  INT          NOT NULL REFERENCES miembro(id_miembro),
  archivo_url     VARCHAR(300),
  id_estado       INT          NOT NULL REFERENCES estado(id_estado),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
SELECT fn_add_updated_at_trigger('documento');
CREATE INDEX idx_documento_miembro ON documento(id_miembro);
CREATE INDEX idx_documento_tipo    ON documento(tipo_documento);


-- =============================================================
--  12. MÓDULO AUDITORÍA
-- =============================================================
CREATE TABLE auditoria_log (
  id_log            BIGSERIAL    PRIMARY KEY,
  id_usuario        INT          REFERENCES usuario_sistema(id_usuario),
  tabla_afectada    VARCHAR(60)  NOT NULL,
  accion            VARCHAR(10)  NOT NULL CHECK (accion IN ('INSERT','UPDATE','DELETE')),
  id_registro       INT,
  datos_anteriores  JSONB,
  datos_nuevos      JSONB,
  fecha_hora        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ip_origen         INET
);
CREATE INDEX idx_auditoria_usuario ON auditoria_log(id_usuario);
CREATE INDEX idx_auditoria_tabla   ON auditoria_log(tabla_afectada);
CREATE INDEX idx_auditoria_fecha   ON auditoria_log(fecha_hora);


-- =============================================================
--  VISTAS ÚTILES
-- =============================================================

-- Miembros con su estado y tipo legibles
CREATE VIEW v_miembros AS
SELECT
  m.id_miembro,
  m.nombres || ' ' || m.apellidos AS nombre_completo,
  m.rut, m.telefono, m.email,
  m.fecha_nacimiento,
  m.fecha_ingreso,
  tm.nombre   AS tipo_miembro,
  e.nombre    AS estado,
  e.color_hex AS estado_color,
  c.nombre    AS congregacion,
  mi.nombre   AS ministerio
FROM miembro m
JOIN tipo_miembro  tm ON tm.id_tipo          = m.id_tipo_miembro
JOIN estado         e ON e.id_estado         = m.id_estado
JOIN congregacion   c ON c.id_congregacion   = m.id_congregacion
LEFT JOIN ministerio mi ON mi.id_ministerio  = m.id_ministerio;

-- Resumen financiero por cuenta y congregación
CREATE VIEW v_resumen_financiero AS
SELECT
  fc.id_cuenta,
  fc.nombre   AS cuenta,
  fc.tipo,
  c.nombre    AS congregacion,
  fc.saldo_actual,
  COUNT(t.id_transaccion)                                  AS total_transacciones,
  COALESCE(SUM(t.monto) FILTER (WHERE t.tipo = 'ingreso'), 0) AS total_ingresos,
  COALESCE(SUM(t.monto) FILTER (WHERE t.tipo = 'egreso'),  0) AS total_egresos
FROM finanza_cuenta fc
JOIN congregacion    c ON c.id_congregacion = fc.id_congregacion
LEFT JOIN transaccion t ON t.id_cuenta = fc.id_cuenta
  AND t.id_estado IN (SELECT id_estado FROM estado WHERE codigo = 'CONFIRMADA')
GROUP BY fc.id_cuenta, fc.nombre, fc.tipo, c.nombre, fc.saldo_actual;

-- Próximas visitas pastorales pendientes
CREATE VIEW v_visitas_pendientes AS
SELECT
  vp.id_visita,
  m.nombres || ' ' || m.apellidos   AS miembro,
  p.nombres || ' ' || p.apellidos   AS pastor,
  vp.fecha_visita,
  vp.motivo,
  e.nombre AS estado
FROM visita_pastoral vp
JOIN miembro m ON m.id_miembro = vp.id_miembro
JOIN miembro p ON p.id_miembro = vp.id_pastor
JOIN estado  e ON e.id_estado  = vp.id_estado
WHERE e.codigo = 'PENDIENTE'
ORDER BY vp.fecha_visita;

-- Historial espiritual con tipo de hito legible
CREATE VIEW v_historial_espiritual AS
SELECT
  he.id_hito,
  m.nombres  || ' ' || m.apellidos  AS miembro,
  th.nombre                          AS tipo_hito,
  he.fecha_hito,
  he.lugar,
  mp.nombres || ' ' || mp.apellidos AS ministro,
  he.observaciones,
  he.documento_url
FROM historial_espiritual he
JOIN miembro   m  ON m.id_miembro  = he.id_miembro
JOIN tipo_hito th ON th.id_tipo_hito = he.id_tipo_hito
LEFT JOIN miembro mp ON mp.id_miembro = he.id_ministro
ORDER BY he.fecha_hito DESC;

-- =============================================================
--  FIN DEL SCRIPT
-- =============================================================
