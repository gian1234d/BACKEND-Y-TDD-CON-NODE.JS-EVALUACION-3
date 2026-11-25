PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'USUARIO' CHECK (rol IN ('USUARIO', 'ADMIN')),
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

CREATE TABLE IF NOT EXISTS publicaciones (
  id INTEGER PRIMARY KEY,
  propietario_id INTEGER NOT NULL REFERENCES usuarios(id),
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  categoria TEXT NOT NULL,
  modalidad TEXT NOT NULL CHECK (modalidad IN ('DONACION', 'INTERCAMBIO')),
  estado TEXT NOT NULL DEFAULT 'DISPONIBLE'
    CHECK (estado IN ('DISPONIBLE', 'RESERVADA', 'ENTREGADA', 'CANCELADA')),
  fecha_publicacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS solicitudes (
  id INTEGER PRIMARY KEY,
  publicacion_id INTEGER NOT NULL REFERENCES publicaciones(id),
  solicitante_id INTEGER NOT NULL REFERENCES usuarios(id),
  mensaje TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'CANCELADA')),
  fecha_solicitud TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_pendientes_por_usuario
  ON solicitudes (publicacion_id, solicitante_id) WHERE estado = 'PENDIENTE';

CREATE UNIQUE INDEX IF NOT EXISTS solicitud_aceptada_por_publicacion
  ON solicitudes (publicacion_id) WHERE estado = 'ACEPTADA';

CREATE TABLE IF NOT EXISTS entregas (
  id INTEGER PRIMARY KEY,
  publicacion_id INTEGER NOT NULL UNIQUE REFERENCES publicaciones(id),
  solicitud_id INTEGER NOT NULL UNIQUE REFERENCES solicitudes(id),
  propietario_id INTEGER NOT NULL REFERENCES usuarios(id),
  receptor_id INTEGER NOT NULL REFERENCES usuarios(id),
  fecha_acuerdo TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_entrega TEXT,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'COMPLETADA')),
  CHECK (propietario_id <> receptor_id),
  CHECK ((estado = 'PENDIENTE' AND fecha_entrega IS NULL)
    OR (estado = 'COMPLETADA' AND fecha_entrega IS NOT NULL))
);
