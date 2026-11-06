-- 1. Usuarios (HU1)
-- password_hash no está en las entidades sugeridas, pero hace falta
-- para el login: sin saber quién es el usuario no se pueden validar
-- permisos. Nunca se guarda la contraseña en texto plano.
CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(150) NOT NULL UNIQUE,
    username        VARCHAR(32)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    fecha_registro  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- 2. Servidores (HU2, HU10)
-- No se puede borrar un usuario que todavía es dueño de un servidor
-- (la FK sin ON DELETE lo impide): primero hay que transferirlo.
CREATE TABLE servidores (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    duenio_id       INTEGER      NOT NULL REFERENCES usuarios(id),
    fecha_creacion  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- 3. Canales (HU3)
-- El nombre es único dentro de cada servidor (dos servidores distintos
-- sí pueden tener un canal "general" cada uno).
CREATE TABLE canales (
    id            SERIAL PRIMARY KEY,
    servidor_id   INTEGER      NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
    nombre        VARCHAR(100) NOT NULL,
    tipo          VARCHAR(10)  NOT NULL CHECK (tipo IN ('texto', 'voz')),
    solo_lectura  BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_canal_nombre_por_servidor UNIQUE (servidor_id, nombre)
);


-- 4. Roles (HU4)
-- El rol predeterminado de cada servidor se llama '@everyone'.
CREATE TABLE roles (
    id              SERIAL PRIMARY KEY,
    servidor_id     INTEGER     NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
    nombre          VARCHAR(50) NOT NULL,
    puede_escribir  BOOLEAN     NOT NULL DEFAULT FALSE,
    puede_moderar   BOOLEAN     NOT NULL DEFAULT FALSE,
    puede_invitar   BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_rol_nombre_por_servidor UNIQUE (servidor_id, nombre)
);


-- 5. Miembros: relación N a M entre usuarios y servidores (HU2, HU6, HU9, HU10)
-- Expulsar = borrar la fila. Banear = dejar la fila con baneado = TRUE,
-- así el sistema recuerda que esa persona no puede volver a entrar.
CREATE TABLE miembros (
    usuario_id   INTEGER   NOT NULL REFERENCES usuarios(id)   ON DELETE CASCADE,
    servidor_id  INTEGER   NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
    fecha_union  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    baneado      BOOLEAN   NOT NULL DEFAULT FALSE,
    PRIMARY KEY (usuario_id, servidor_id)
);


-- 6. Roles de cada miembro: relación N a M entre usuarios y roles (HU4)
-- Que el rol pertenezca al mismo servidor que el miembro se valida en
-- la API (services), porque esta tabla no guarda el servidor.
CREATE TABLE roles_miembro (
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol_id      INTEGER NOT NULL REFERENCES roles(id)    ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, rol_id)
);


-- 7. Invitaciones (HU5, HU6)
-- Que fecha_vencimiento sea futura se valida en la API al crearla:
-- no puede ser un CHECK porque con el tiempo toda fecha queda en el pasado.
CREATE TABLE invitaciones (
    id                 SERIAL PRIMARY KEY,
    servidor_id        INTEGER     NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
    creador_id         INTEGER     NOT NULL REFERENCES usuarios(id)   ON DELETE CASCADE,
    codigo             VARCHAR(20) NOT NULL UNIQUE,
    usos_maximos       INTEGER     NOT NULL CHECK (usos_maximos > 0),
    usos               INTEGER     NOT NULL DEFAULT 0,
    fecha_vencimiento  TIMESTAMP   NOT NULL,
    CONSTRAINT chk_usos_validos CHECK (usos >= 0 AND usos <= usos_maximos)
);


-- 8. Mensajes (HU7, HU8, HU11, HU12)
-- El contenido no puede estar vacío (ni ser solo espacios) ni superar
-- los 2000 caracteres. La API también lo valida antes de llegar acá.
CREATE TABLE mensajes (
    id         SERIAL PRIMARY KEY,
    canal_id   INTEGER   NOT NULL REFERENCES canales(id)  ON DELETE CASCADE,
    autor_id   INTEGER   NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    contenido  TEXT      NOT NULL,
    fecha      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    editado    BOOLEAN   NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_contenido_valido
        CHECK (char_length(btrim(contenido)) > 0 AND char_length(contenido) <= 2000)
);

-- Índices para las consultas más frecuentes:
-- paginación de mensajes por canal (HU8) y estadísticas por fecha (HU11, HU12).
CREATE INDEX idx_mensajes_canal_id ON mensajes (canal_id, id);
CREATE INDEX idx_mensajes_fecha    ON mensajes (fecha);
