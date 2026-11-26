-- =====================================================================
-- Kort — Plataforma de comunidades (Proyecto 2)
-- Script de creación de tablas (PostgreSQL)
--
-- Cómo usarlo: en pgAdmin, abrir el Query Tool sobre la base del
-- proyecto y ejecutar este archivo completo. Después ejecutar seed.sql.
--
-- ATENCIÓN: las primeras líneas BORRAN las tablas si ya existen, para
-- poder volver a correr el script desde cero. Se pierden los datos.
-- =====================================================================

DROP TABLE IF EXISTS notificaciones          CASCADE;
DROP TABLE IF EXISTS directos_fijados        CASCADE;
DROP TABLE IF EXISTS preferencias            CASCADE;
DROP TABLE IF EXISTS puntos                  CASCADE;
DROP TABLE IF EXISTS votos_encuesta          CASCADE;
DROP TABLE IF EXISTS opciones_encuesta       CASCADE;
DROP TABLE IF EXISTS encuestas               CASCADE;
DROP TABLE IF EXISTS tareas                  CASCADE;
DROP TABLE IF EXISTS evento_asistentes       CASCADE;
DROP TABLE IF EXISTS eventos                 CASCADE;
DROP TABLE IF EXISTS estados                 CASCADE;
DROP TABLE IF EXISTS publicacion_comentarios CASCADE;
DROP TABLE IF EXISTS publicacion_likes       CASCADE;
DROP TABLE IF EXISTS publicaciones           CASCADE;
DROP TABLE IF EXISTS historial_servidores    CASCADE;
DROP TABLE IF EXISTS fotos_perfil            CASCADE;
DROP TABLE IF EXISTS redes_sociales          CASCADE;
DROP TABLE IF EXISTS etiquetas_usuario       CASCADE;
DROP TABLE IF EXISTS mensajes_directos       CASCADE;
DROP TABLE IF EXISTS amistades               CASCADE;
DROP TABLE IF EXISTS reacciones              CASCADE;
DROP TABLE IF EXISTS mensajes      CASCADE;
DROP TABLE IF EXISTS invitaciones  CASCADE;
DROP TABLE IF EXISTS roles_miembro CASCADE;
DROP TABLE IF EXISTS miembros      CASCADE;
DROP TABLE IF EXISTS roles         CASCADE;
DROP TABLE IF EXISTS canales       CASCADE;
DROP TABLE IF EXISTS servidores    CASCADE;
DROP TABLE IF EXISTS usuarios      CASCADE;


-- 1. Usuarios (HU1)
-- password_hash no está en las entidades sugeridas, pero hace falta
-- para el login: sin saber quién es el usuario no se pueden validar
-- permisos. Nunca se guarda la contraseña en texto plano.
CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(150) NOT NULL UNIQUE,
    username        VARCHAR(32)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    fecha_registro  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Perfil: biografía corta y foto principal (copia de la marcada en fotos_perfil).
    bio             VARCHAR(190),
    avatar_url      VARCHAR(255)
);


-- 2. Servidores (HU2, HU10)
-- No se puede borrar un usuario que todavía es dueño de un servidor
-- (la FK sin ON DELETE lo impide): primero hay que transferirlo.
CREATE TABLE servidores (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    duenio_id       INTEGER      NOT NULL REFERENCES usuarios(id),
    fecha_creacion  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Servidores temporales: si tiene fecha, se borra solo al llegar a ella.
    expira_en       TIMESTAMP,
    -- Foto del servidor (la elige el dueño). NULL = se muestran las iniciales.
    icono_url       VARCHAR(255),
    -- Contraseña para borrar el servidor (se elige al crearlo; se guarda con
    -- bcrypt, nunca en texto plano). NULL = se pide la contraseña de la cuenta del dueño.
    clave_borrado_hash VARCHAR(255),
    -- Público: aparece en "Explorar" y cualquiera puede unirse sin invitación.
    -- Privado (por defecto): solo se entra con una invitación.
    publico         BOOLEAN      NOT NULL DEFAULT FALSE,
    descripcion     VARCHAR(300) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_servidores_publicos ON servidores (publico) WHERE publico;


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
    -- Apodo dentro de este servidor (si es NULL se muestra el username).
    apodo        VARCHAR(32),
    -- Orden en que el usuario quiere ver sus servidores en la barra lateral.
    posicion     INTEGER,
    -- Qué foto de perfil usa en este servidor (NULL = su foto principal).
    -- La FK se agrega más abajo, después de crear fotos_perfil.
    foto_id      INTEGER,
    -- Orden personal de las pestañas del servidor (lista JSON). Solo lo ve él.
    orden_secciones TEXT,
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
-- El contenido no puede superar los 2000 caracteres y no puede estar vacío,
-- salvo que el mensaje lleve un archivo adjunto (imagen, audio, video).
-- La API también lo valida antes de llegar acá.
CREATE TABLE mensajes (
    id              SERIAL PRIMARY KEY,
    canal_id        INTEGER      NOT NULL REFERENCES canales(id)  ON DELETE CASCADE,
    autor_id        INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    contenido       TEXT         NOT NULL DEFAULT '',
    fecha           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    editado         BOOLEAN      NOT NULL DEFAULT FALSE,
    adjunto_url     VARCHAR(255),
    adjunto_tipo    VARCHAR(10)  CHECK (adjunto_tipo IN ('imagen', 'audio', 'video', 'archivo')),
    adjunto_nombre  VARCHAR(255),
    fijado          BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_contenido_valido CHECK (
        char_length(contenido) <= 2000
        AND (char_length(btrim(contenido)) > 0 OR adjunto_url IS NOT NULL)
    )
);

-- Índices para las consultas más frecuentes:
-- paginación de mensajes por canal (HU8) y estadísticas por fecha (HU11, HU12).
CREATE INDEX idx_mensajes_canal_id ON mensajes (canal_id, id);
CREATE INDEX idx_mensajes_fecha    ON mensajes (fecha);


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
    -- Quién la ve en el perfil: 'todos', 'amigos' u 'oculta' (solo en los
    -- servidores donde la elegiste como foto).
    visibilidad VARCHAR(10)  NOT NULL DEFAULT 'todos' CHECK (visibilidad IN ('todos', 'amigos', 'oculta')),
    fecha       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
    ALTER TABLE miembros ADD CONSTRAINT fk_miembro_foto
        FOREIGN KEY (foto_id) REFERENCES fotos_perfil(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


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
                         'salio', 'expulsado', 'baneado', 'servidor_borrado', 'servidor_vencido')),
    -- Roles que tenía al salir (lista JSON, ej: ["Dueño", "Moderador"]).
    -- Mientras sigue siendo miembro queda en NULL: se calculan en el momento.
    roles            TEXT
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
    fecha_completada  TIMESTAMP,
    -- Imagen opcional de la tarea (archivo subido a Kort).
    imagen_url        VARCHAR(255),
    -- Puntos para el scoreboard que gana quien la complete (los fija un
    -- moderador o el dueño). Se otorgan al pasarla a 'hecha' y se descuentan
    -- si se vuelve a abrir. puntos_otorgados_a guarda a quién se le dieron.
    puntos            INTEGER       NOT NULL DEFAULT 0,
    puntos_otorgados_a INTEGER      REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT chk_tarea_puntos CHECK (puntos BETWEEN 0 AND 1000)
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


-- 21. Conversaciones fijadas en los mensajes directos (cada uno elige las suyas
-- y su orden; siempre aparecen arriba).
CREATE TABLE IF NOT EXISTS directos_fijados (
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    otro_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    posicion    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (usuario_id, otro_id),
    CONSTRAINT chk_fijado_distinto CHECK (usuario_id <> otro_id)
);


-- 22. Notificaciones: avisos para cada usuario (lo mencionaron con @, le
-- escribieron por privado, le mandaron una solicitud de amistad, le
-- asignaron una tarea...). El texto se guarda ya armado.
CREATE TABLE IF NOT EXISTS notificaciones (
    id           SERIAL PRIMARY KEY,
    usuario_id   INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo         VARCHAR(20)  NOT NULL,
    actor_id     INTEGER      REFERENCES usuarios(id) ON DELETE SET NULL,
    texto        VARCHAR(200) NOT NULL,
    servidor_id  INTEGER      REFERENCES servidores(id) ON DELETE CASCADE,
    canal_id     INTEGER      REFERENCES canales(id)    ON DELETE CASCADE,
    mensaje_id   INTEGER      REFERENCES mensajes(id)   ON DELETE CASCADE,
    leida        BOOLEAN      NOT NULL DEFAULT FALSE,
    fecha        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_notificacion_tipo CHECK (tipo IN (
        'mencion', 'mensaje_directo', 'solicitud_amistad', 'amistad_aceptada', 'tarea_asignada'))
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones (usuario_id, leida, fecha);
