-- =====================================================================
-- Kort — Migración a la versión 2 (funciones nuevas)
--
-- Para quien YA tiene la base creada con el tables.sql anterior y no
-- quiere perder sus datos: ejecutar este archivo una sola vez en pgAdmin.
-- No borra nada: solo agrega columnas y tablas. Se puede volver a correr
-- sin problema (todo usa IF NOT EXISTS).
--
-- Si preferís arrancar de cero: ejecutá tables.sql y después seed.sql.
-- =====================================================================

-- Columnas nuevas en tablas que ya existían ----------------------------
ALTER TABLE usuarios   ADD COLUMN IF NOT EXISTS bio        VARCHAR(190);
ALTER TABLE usuarios   ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);

ALTER TABLE servidores ADD COLUMN IF NOT EXISTS expira_en  TIMESTAMP;

ALTER TABLE miembros   ADD COLUMN IF NOT EXISTS apodo      VARCHAR(32);
ALTER TABLE miembros   ADD COLUMN IF NOT EXISTS posicion   INTEGER;

ALTER TABLE mensajes   ADD COLUMN IF NOT EXISTS adjunto_url    VARCHAR(255);
ALTER TABLE mensajes   ADD COLUMN IF NOT EXISTS adjunto_tipo   VARCHAR(10)
    CHECK (adjunto_tipo IN ('imagen', 'audio', 'video', 'archivo'));
ALTER TABLE mensajes   ADD COLUMN IF NOT EXISTS adjunto_nombre VARCHAR(255);
ALTER TABLE mensajes   ADD COLUMN IF NOT EXISTS fijado         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE mensajes   ALTER COLUMN contenido SET DEFAULT '';

-- Un mensaje con archivo adjunto puede no tener texto.
ALTER TABLE mensajes DROP CONSTRAINT IF EXISTS chk_contenido_valido;
ALTER TABLE mensajes ADD CONSTRAINT chk_contenido_valido CHECK (
    char_length(contenido) <= 2000
    AND (char_length(btrim(contenido)) > 0 OR adjunto_url IS NOT NULL)
);


-- =====================================================================
-- Funciones nuevas de Kort (v2)
-- =====================================================================

-- 9. Reacciones con emojis a los mensajes.
-- Cada persona puede reaccionar una vez con cada emoji en cada mensaje.
CREATE TABLE IF NOT EXISTS reacciones (
    mensaje_id  INTEGER     NOT NULL REFERENCES mensajes(id) ON DELETE CASCADE,
    usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    emoji       VARCHAR(32) NOT NULL,
    fecha       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mensaje_id, usuario_id, emoji)
);


-- 10. Encuestas. Cada encuesta se publica como un mensaje del canal
-- (la pregunta es el contenido del mensaje). Si se borra el mensaje,
-- se borra la encuesta. fecha_limite NULL = sin fecha límite.
CREATE TABLE IF NOT EXISTS encuestas (
    id            SERIAL PRIMARY KEY,
    mensaje_id    INTEGER   NOT NULL UNIQUE REFERENCES mensajes(id) ON DELETE CASCADE,
    multiple      BOOLEAN   NOT NULL DEFAULT FALSE,
    fecha_limite  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS opciones_encuesta (
    id           SERIAL PRIMARY KEY,
    encuesta_id  INTEGER      NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
    texto        VARCHAR(100) NOT NULL,
    orden        INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS votos_encuesta (
    encuesta_id  INTEGER NOT NULL REFERENCES encuestas(id)         ON DELETE CASCADE,
    opcion_id    INTEGER NOT NULL REFERENCES opciones_encuesta(id) ON DELETE CASCADE,
    usuario_id   INTEGER NOT NULL REFERENCES usuarios(id)          ON DELETE CASCADE,
    PRIMARY KEY (opcion_id, usuario_id)
);


-- 11. Amistades. Una sola fila por par de usuarios (no importa quién la pidió).
CREATE TABLE IF NOT EXISTS amistades (
    id               SERIAL PRIMARY KEY,
    solicitante_id   INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    receptor_id      INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    estado           VARCHAR(10) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada')),
    fecha            TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_respuesta  TIMESTAMP,
    CONSTRAINT chk_amistad_distintos CHECK (solicitante_id <> receptor_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_amistad_par
    ON amistades (LEAST(solicitante_id, receptor_id), GREATEST(solicitante_id, receptor_id));


-- 12. Mensajes directos (entre dos usuarios, fuera de los servidores).
CREATE TABLE IF NOT EXISTS mensajes_directos (
    id               SERIAL PRIMARY KEY,
    remitente_id     INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    destinatario_id  INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    contenido        TEXT         NOT NULL DEFAULT '',
    fecha            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    editado          BOOLEAN      NOT NULL DEFAULT FALSE,
    leido            BOOLEAN      NOT NULL DEFAULT FALSE,
    adjunto_url      VARCHAR(255),
    adjunto_tipo     VARCHAR(10)  CHECK (adjunto_tipo IN ('imagen', 'audio', 'video', 'archivo')),
    adjunto_nombre   VARCHAR(255),
    CONSTRAINT chk_md_distintos CHECK (remitente_id <> destinatario_id),
    CONSTRAINT chk_md_contenido CHECK (
        char_length(contenido) <= 2000
        AND (char_length(btrim(contenido)) > 0 OR adjunto_url IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_md_conversacion
    ON mensajes_directos (LEAST(remitente_id, destinatario_id), GREATEST(remitente_id, destinatario_id), id);


-- 13. Perfil: etiquetas, redes sociales y varias fotos.
CREATE TABLE IF NOT EXISTS etiquetas_usuario (
    usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    etiqueta    VARCHAR(24) NOT NULL,
    PRIMARY KEY (usuario_id, etiqueta)
);

CREATE TABLE IF NOT EXISTS redes_sociales (
    usuario_id  INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    red         VARCHAR(20)  NOT NULL CHECK (red IN (
                    'instagram', 'x', 'tiktok', 'youtube', 'twitch',
                    'github', 'spotify', 'linkedin', 'web')),
    url         VARCHAR(255) NOT NULL,
    PRIMARY KEY (usuario_id, red)
);

CREATE TABLE IF NOT EXISTS fotos_perfil (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    url         VARCHAR(255) NOT NULL,
    principal   BOOLEAN      NOT NULL DEFAULT FALSE,
    visibilidad VARCHAR(10)  NOT NULL DEFAULT 'todos' CHECK (visibilidad IN ('todos', 'amigos', 'oculta')),
    fecha       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- 14. Historial de servidores en los que estuvo cada usuario.
-- Se guarda el nombre porque el servidor puede dejar de existir
-- (en ese caso servidor_id queda en NULL).
CREATE TABLE IF NOT EXISTS historial_servidores (
    id               SERIAL PRIMARY KEY,
    usuario_id       INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    servidor_id      INTEGER      REFERENCES servidores(id) ON DELETE SET NULL,
    servidor_nombre  VARCHAR(100) NOT NULL,
    fecha_union      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_salida     TIMESTAMP,
    motivo_salida    VARCHAR(20)  CHECK (motivo_salida IN (
                         'salio', 'expulsado', 'baneado', 'servidor_borrado', 'servidor_vencido'))
);
CREATE INDEX IF NOT EXISTS idx_historial_usuario ON historial_servidores (usuario_id, fecha_union);


-- 15. Publicaciones: en el perfil (servidor_id NULL) o dentro de un servidor.
CREATE TABLE IF NOT EXISTS publicaciones (
    id           SERIAL PRIMARY KEY,
    autor_id     INTEGER      NOT NULL REFERENCES usuarios(id)   ON DELETE CASCADE,
    servidor_id  INTEGER      REFERENCES servidores(id) ON DELETE CASCADE,
    contenido    TEXT         NOT NULL DEFAULT '',
    imagen_url   VARCHAR(255),
    -- Flyer: invitación a un servidor para que cualquiera se una desde la publicación.
    invitacion_id INTEGER     REFERENCES invitaciones(id) ON DELETE SET NULL,
    fecha        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Que tenga texto, imagen o flyer lo valida la API. No va en un CHECK porque,
    -- si se borra el servidor del flyer, invitacion_id pasa a NULL y la base
    -- rechazaría el borrado. Las publicaciones que quedan vacías las borra la
    -- limpieza automática.
    CONSTRAINT chk_publicacion_valida CHECK (char_length(contenido) <= 2000)
);

CREATE TABLE IF NOT EXISTS publicacion_likes (
    publicacion_id  INTEGER NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id)      ON DELETE CASCADE,
    PRIMARY KEY (publicacion_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS publicacion_comentarios (
    id              SERIAL PRIMARY KEY,
    publicacion_id  INTEGER      NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
    autor_id        INTEGER      NOT NULL REFERENCES usuarios(id)      ON DELETE CASCADE,
    contenido       VARCHAR(500) NOT NULL CHECK (char_length(btrim(contenido)) > 0),
    fecha           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- 16. Estados: publicaciones cortas que duran 24 horas (las ven los amigos).
CREATE TABLE IF NOT EXISTS estados (
    id           SERIAL PRIMARY KEY,
    usuario_id   INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    contenido    VARCHAR(200) NOT NULL DEFAULT '',
    imagen_url   VARCHAR(255),
    color_fondo  VARCHAR(7)   NOT NULL DEFAULT '#ff6b5b',
    invitacion_id INTEGER     REFERENCES invitaciones(id) ON DELETE SET NULL,  -- flyer
    fecha        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vence        TIMESTAMP    NOT NULL,
    -- Igual que en publicaciones: el contenido lo valida la API.
    CONSTRAINT chk_estado_valido CHECK (char_length(contenido) <= 200)
);


-- 17. Calendario del servidor.
CREATE TABLE IF NOT EXISTS eventos (
    id           SERIAL PRIMARY KEY,
    servidor_id  INTEGER       NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
    creador_id   INTEGER       NOT NULL REFERENCES usuarios(id)   ON DELETE CASCADE,
    titulo       VARCHAR(100)  NOT NULL,
    descripcion  VARCHAR(1000) NOT NULL DEFAULT '',
    lugar        VARCHAR(100)  NOT NULL DEFAULT '',
    inicio       TIMESTAMP     NOT NULL,
    fin          TIMESTAMP,
    CONSTRAINT chk_evento_fechas CHECK (fin IS NULL OR fin >= inicio)
);

CREATE TABLE IF NOT EXISTS evento_asistentes (
    evento_id   INTEGER NOT NULL REFERENCES eventos(id)  ON DELETE CASCADE,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    PRIMARY KEY (evento_id, usuario_id)
);


-- 18. Tareas asignadas dentro de un servidor.
CREATE TABLE IF NOT EXISTS tareas (
    id                SERIAL PRIMARY KEY,
    servidor_id       INTEGER       NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
    creador_id        INTEGER       NOT NULL REFERENCES usuarios(id)   ON DELETE CASCADE,
    asignado_id       INTEGER       REFERENCES usuarios(id) ON DELETE SET NULL,
    titulo            VARCHAR(120)  NOT NULL,
    descripcion       VARCHAR(1000) NOT NULL DEFAULT '',
    fecha_limite      TIMESTAMP,
    estado            VARCHAR(12)   NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente', 'en_progreso', 'hecha')),
    fecha_creacion    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_completada  TIMESTAMP
);


-- 19. Puntos del scoreboard de cada servidor (los da un moderador,
-- o se ganan jugando en las llamadas).
CREATE TABLE IF NOT EXISTS puntos (
    id            SERIAL PRIMARY KEY,
    servidor_id   INTEGER      NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
    usuario_id    INTEGER      NOT NULL REFERENCES usuarios(id)   ON DELETE CASCADE,
    otorgado_por  INTEGER      REFERENCES usuarios(id) ON DELETE SET NULL,
    cantidad      INTEGER      NOT NULL CHECK (cantidad <> 0 AND cantidad BETWEEN -1000 AND 1000),
    motivo        VARCHAR(100) NOT NULL DEFAULT '',
    fecha         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- 20. Apariencia elegida por cada usuario (colores, tipografía, tamaño).
CREATE TABLE IF NOT EXISTS preferencias (
    usuario_id      INTEGER     PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    tema            VARCHAR(20) NOT NULL DEFAULT 'kort',
    color_primario  VARCHAR(7)  NOT NULL DEFAULT '#e2553d',
    fuente          VARCHAR(20) NOT NULL DEFAULT 'geist',
    tamanio_fuente  INTEGER     NOT NULL DEFAULT 16 CHECK (tamanio_fuente BETWEEN 12 AND 20),
    compacto        BOOLEAN     NOT NULL DEFAULT FALSE,
    -- Pestañas del servidor en fila ('horizontal') o en columna ('vertical').
    disposicion     VARCHAR(10) NOT NULL DEFAULT 'horizontal' CHECK (disposicion IN ('horizontal', 'vertical'))
);


-- Historial: se completa con las membresías que ya existían ------------
INSERT INTO historial_servidores (usuario_id, servidor_id, servidor_nombre, fecha_union, fecha_salida, motivo_salida)
SELECT m.usuario_id, m.servidor_id, s.nombre, m.fecha_union,
       CASE WHEN m.baneado THEN CURRENT_TIMESTAMP END,
       CASE WHEN m.baneado THEN 'baneado' END
FROM miembros m
JOIN servidores s ON s.id = m.servidor_id
WHERE NOT EXISTS (
    SELECT 1 FROM historial_servidores h
    WHERE h.usuario_id = m.usuario_id AND h.servidor_id = m.servidor_id
);


-- Identidad visual propia de Kort: el tema por defecto pasa a ser 'kort'
-- (si ya habías creado la tabla con la versión anterior de este archivo).
ALTER TABLE preferencias ALTER COLUMN tema SET DEFAULT 'kort';
ALTER TABLE preferencias ALTER COLUMN color_primario SET DEFAULT '#e2553d';


-- Fotos por servidor y orden personal de las pestañas ------------------
-- (para quien ya había corrido una versión anterior de este archivo)
ALTER TABLE fotos_perfil ADD COLUMN IF NOT EXISTS visibilidad VARCHAR(10) NOT NULL DEFAULT 'todos'
    CHECK (visibilidad IN ('todos', 'amigos', 'oculta'));
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS foto_id INTEGER;
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS orden_secciones TEXT;
DO $$ BEGIN
    ALTER TABLE miembros ADD CONSTRAINT fk_miembro_foto
        FOREIGN KEY (foto_id) REFERENCES fotos_perfil(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- Flyers: publicaciones y estados que invitan a un servidor -------------
ALTER TABLE publicaciones ADD COLUMN IF NOT EXISTS invitacion_id INTEGER REFERENCES invitaciones(id) ON DELETE SET NULL;
ALTER TABLE estados       ADD COLUMN IF NOT EXISTS invitacion_id INTEGER REFERENCES invitaciones(id) ON DELETE SET NULL;
-- El contenido lo valida la API (ver tables.sql): así se puede borrar un servidor
-- aunque tenga flyers sin texto.
ALTER TABLE publicaciones DROP CONSTRAINT IF EXISTS chk_publicacion_valida;
ALTER TABLE publicaciones ADD CONSTRAINT chk_publicacion_valida CHECK (char_length(contenido) <= 2000);
ALTER TABLE estados DROP CONSTRAINT IF EXISTS chk_estado_valido;
ALTER TABLE estados ADD CONSTRAINT chk_estado_valido CHECK (char_length(contenido) <= 200);


-- Pestañas del servidor en fila o en columna ---------------------------
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS disposicion VARCHAR(10) NOT NULL DEFAULT 'horizontal'
    CHECK (disposicion IN ('horizontal', 'vertical'));
