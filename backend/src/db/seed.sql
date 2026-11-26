-- =====================================================================
-- Kort — Datos de ejemplo (al menos 5 filas por tabla)
--
-- Ejecutar DESPUÉS de tables.sql, sobre la base recién creada
-- (los ids 1, 2, 3... se asumen en ese orden).
--
-- Todos los usuarios tienen la contraseña:  password123
-- =====================================================================

-- pgcrypto permite generar hashes bcrypt desde SQL, compatibles con el
-- login de la API (passlib/bcrypt).
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- USUARIOS ------------------------------------------------------------
INSERT INTO usuarios (email, username, password_hash, fecha_registro) VALUES
('ana@mail.com',   'ana',   crypt('password123', gen_salt('bf')), CURRENT_TIMESTAMP - INTERVAL '120 days'), -- id 1
('bruno@mail.com', 'bruno', crypt('password123', gen_salt('bf')), CURRENT_TIMESTAMP - INTERVAL '110 days'), -- id 2
('carla@mail.com', 'carla', crypt('password123', gen_salt('bf')), CURRENT_TIMESTAMP - INTERVAL '90 days'),  -- id 3
('diego@mail.com', 'diego', crypt('password123', gen_salt('bf')), CURRENT_TIMESTAMP - INTERVAL '60 days'),  -- id 4
('elena@mail.com', 'elena', crypt('password123', gen_salt('bf')), CURRENT_TIMESTAMP - INTERVAL '40 days');  -- id 5


-- SERVIDORES ----------------------------------------------------------
INSERT INTO servidores (nombre, duenio_id, fecha_creacion) VALUES
('4to B - Programación', 1, CURRENT_TIMESTAMP - INTERVAL '100 days'), -- id 1 (dueña: ana)
('Club de Ajedrez',      2, CURRENT_TIMESTAMP - INTERVAL '95 days'),  -- id 2 (dueño: bruno)
('Gamers del barrio',    3, CURRENT_TIMESTAMP - INTERVAL '80 days'),  -- id 3 (dueña: carla)
('Robótica',             4, CURRENT_TIMESTAMP - INTERVAL '55 days'),  -- id 4 (dueño: diego)
('Club de Lectura',      5, CURRENT_TIMESTAMP - INTERVAL '35 days');  -- id 5 (dueña: elena)


-- CANALES -------------------------------------------------------------
-- Cada servidor tiene su canal 'general' (como si se hubiera creado con HU2).
INSERT INTO canales (servidor_id, nombre, tipo, solo_lectura) VALUES
(1, 'general',         'texto', FALSE), -- id 1
(2, 'general',         'texto', FALSE), -- id 2
(3, 'general',         'texto', FALSE), -- id 3
(4, 'general',         'texto', FALSE), -- id 4 (sin mensajes recientes: canal inactivo)
(5, 'general',         'texto', FALSE), -- id 5
(1, 'anuncios',        'texto', TRUE),  -- id 6 (solo lectura)
(1, 'sala-de-estudio', 'voz',   FALSE), -- id 7 (voz: no admite mensajes)
(1, 'dudas',           'texto', FALSE), -- id 8
(3, 'partidas',        'voz',   FALSE); -- id 9


-- ROLES ---------------------------------------------------------------
-- '@everyone' de cada servidor, con permiso para escribir (HU2).
INSERT INTO roles (servidor_id, nombre, puede_escribir, puede_moderar, puede_invitar) VALUES
(1, '@everyone', TRUE, FALSE, FALSE), -- id 1
(2, '@everyone', TRUE, FALSE, FALSE), -- id 2
(3, '@everyone', TRUE, FALSE, FALSE), -- id 3
(4, '@everyone', TRUE, FALSE, FALSE), -- id 4
(5, '@everyone', TRUE, FALSE, FALSE), -- id 5
(1, 'Moderador', TRUE, TRUE,  TRUE),  -- id 6
(3, 'Moderador', TRUE, TRUE,  TRUE),  -- id 7
(1, 'Invitador', TRUE, FALSE, TRUE);  -- id 8


-- MIEMBROS ------------------------------------------------------------
-- Las fechas de unión están repartidas en varios meses para probar HU12.
INSERT INTO miembros (usuario_id, servidor_id, fecha_union, baneado) VALUES
(1, 1, CURRENT_TIMESTAMP - INTERVAL '100 days', FALSE), -- ana, dueña del servidor 1
(2, 2, CURRENT_TIMESTAMP - INTERVAL '95 days',  FALSE), -- bruno, dueño del servidor 2
(3, 3, CURRENT_TIMESTAMP - INTERVAL '80 days',  FALSE), -- carla, dueña del servidor 3
(4, 4, CURRENT_TIMESTAMP - INTERVAL '55 days',  FALSE), -- diego, dueño del servidor 4
(5, 5, CURRENT_TIMESTAMP - INTERVAL '35 days',  FALSE), -- elena, dueña del servidor 5
(2, 1, CURRENT_TIMESTAMP - INTERVAL '90 days',  FALSE), -- bruno en el servidor 1 (moderador)
(3, 1, CURRENT_TIMESTAMP - INTERVAL '60 days',  FALSE), -- carla en el servidor 1
(4, 1, CURRENT_TIMESTAMP - INTERVAL '30 days',  FALSE), -- diego en el servidor 1 (invitador)
(5, 1, CURRENT_TIMESTAMP - INTERVAL '20 days',  TRUE),  -- elena BANEADA del servidor 1
(1, 3, CURRENT_TIMESTAMP - INTERVAL '70 days',  FALSE), -- ana en el servidor 3 (moderadora)
(2, 3, CURRENT_TIMESTAMP - INTERVAL '10 days',  FALSE); -- bruno en el servidor 3


-- ROLES_MIEMBRO -------------------------------------------------------
-- Todo miembro no baneado tiene '@everyone' de su servidor.
-- Un baneado no conserva roles.
INSERT INTO roles_miembro (usuario_id, rol_id) VALUES
(1, 1), (2, 1), (3, 1), (4, 1),   -- @everyone del servidor 1
(2, 2),                           -- @everyone del servidor 2
(3, 3), (1, 3), (2, 3),           -- @everyone del servidor 3
(4, 4),                           -- @everyone del servidor 4
(5, 5),                           -- @everyone del servidor 5
(2, 6),                           -- bruno: Moderador en el servidor 1
(1, 7),                           -- ana: Moderador en el servidor 3
(4, 8);                           -- diego: Invitador en el servidor 1


-- INVITACIONES --------------------------------------------------------
INSERT INTO invitaciones (servidor_id, creador_id, codigo, usos_maximos, usos, fecha_vencimiento) VALUES
(1, 1, 'PROG4B2026', 10, 3, CURRENT_TIMESTAMP + INTERVAL '7 days'),  -- válida
(1, 4, 'VENCIDA001',  5, 0, CURRENT_TIMESTAMP - INTERVAL '1 day'),   -- vencida
(2, 2, 'AJEDREZ123', 20, 1, CURRENT_TIMESTAMP + INTERVAL '30 days'), -- válida
(3, 3, 'LLENA00001',  5, 5, CURRENT_TIMESTAMP + INTERVAL '15 days'), -- sin usos disponibles
(5, 5, 'LECTORES01',  3, 0, CURRENT_TIMESTAMP + INTERVAL '2 days');  -- válida


-- MENSAJES ------------------------------------------------------------
-- Fechas variadas para probar estadísticas (últimos 30 días y por mes).
INSERT INTO mensajes (canal_id, autor_id, contenido, fecha, editado) VALUES
(1, 1, '¡Bienvenidos al servidor de 4to B!',                    CURRENT_TIMESTAMP - INTERVAL '99 days', FALSE),
(1, 2, 'Hola a todos 👋',                                       CURRENT_TIMESTAMP - INTERVAL '89 days', FALSE),
(6, 1, 'Recuerden: la entrega del proyecto es en dos semanas.', CURRENT_TIMESTAMP - INTERVAL '20 days', FALSE),
(8, 3, '¿Alguien entendió cómo funcionan las FK compuestas?',   CURRENT_TIMESTAMP - INTERVAL '15 days', FALSE),
(8, 2, 'Sí, después de clase lo vemos.',                        CURRENT_TIMESTAMP - INTERVAL '14 days', TRUE),
(1, 4, 'Gracias por la invitación.',                            CURRENT_TIMESTAMP - INTERVAL '5 days',  FALSE),
(1, 2, '¿Hacemos videollamada el jueves?',                      CURRENT_TIMESTAMP - INTERVAL '2 days',  FALSE),
(1, 1, 'Dale, el jueves a las 18.',                             CURRENT_TIMESTAMP - INTERVAL '1 day',   FALSE),
(2, 2, 'Torneo interno el sábado.',                             CURRENT_TIMESTAMP - INTERVAL '3 days',  FALSE),
(3, 3, '¿Quién se suma esta noche?',                            CURRENT_TIMESTAMP - INTERVAL '8 days',  FALSE),
(3, 1, 'Yo me sumo.',                                           CURRENT_TIMESTAMP - INTERVAL '8 days',  FALSE),
(4, 4, 'Primer mensaje del club de robótica.',                  CURRENT_TIMESTAMP - INTERVAL '50 days', FALSE),
(5, 5, 'Votemos el libro del mes.', CURRENT_TIMESTAMP - INTERVAL '30 days', FALSE);


-- HISTORIAL DE SERVIDORES ---------------------------------------------
-- Una fila por cada membresía de arriba (los baneados ya salieron).
INSERT INTO historial_servidores (usuario_id, servidor_id, servidor_nombre, fecha_union, fecha_salida, motivo_salida)
SELECT m.usuario_id, m.servidor_id, s.nombre, m.fecha_union,
       CASE WHEN m.baneado THEN CURRENT_TIMESTAMP - INTERVAL '19 days' END,
       CASE WHEN m.baneado THEN 'baneado' END
FROM miembros m
JOIN servidores s ON s.id = m.servidor_id;


-- =====================================================================
-- Datos de ejemplo de las funciones nuevas (v2)
-- =====================================================================

-- APODOS Y ORDEN DE SERVIDORES -----------------------------------------
UPDATE miembros SET apodo = 'Profe Ana' WHERE usuario_id = 1 AND servidor_id = 1;
UPDATE miembros SET apodo = 'Brunito'   WHERE usuario_id = 2 AND servidor_id = 3;
UPDATE miembros SET posicion = 0 WHERE usuario_id = 1 AND servidor_id = 3; -- ana ve primero "Gamers del barrio"
UPDATE miembros SET posicion = 1 WHERE usuario_id = 1 AND servidor_id = 1;

-- PERFILES ------------------------------------------------------------
UPDATE usuarios SET bio = 'Programadora y fan del ajedrez ♟️' WHERE id = 1;
UPDATE usuarios SET bio = 'Moderador de 4to B. Siempre con mate.' WHERE id = 2;
UPDATE usuarios SET bio = 'Gamer de noche, estudiante de día.' WHERE id = 3;

INSERT INTO etiquetas_usuario (usuario_id, etiqueta) VALUES
(1, 'Programación'), (1, 'Ajedrez'), (2, 'Fútbol'), (2, 'Música'), (3, 'Gamer'), (3, 'Anime');

INSERT INTO redes_sociales (usuario_id, red, url) VALUES
(1, 'github',    'https://github.com/'),
(1, 'instagram', 'https://instagram.com/'),
(3, 'twitch',    'https://twitch.tv/');

-- AMISTADES -----------------------------------------------------------
INSERT INTO amistades (solicitante_id, receptor_id, estado, fecha, fecha_respuesta) VALUES
(1, 2, 'aceptada',  CURRENT_TIMESTAMP - INTERVAL '80 days', CURRENT_TIMESTAMP - INTERVAL '79 days'), -- ana y bruno
(1, 3, 'aceptada',  CURRENT_TIMESTAMP - INTERVAL '50 days', CURRENT_TIMESTAMP - INTERVAL '50 days'), -- ana y carla
(4, 2, 'aceptada',  CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '19 days'), -- diego y bruno
(5, 1, 'pendiente', CURRENT_TIMESTAMP - INTERVAL '1 day',   NULL);                                    -- elena le pidió a ana

-- MENSAJES DIRECTOS ---------------------------------------------------
INSERT INTO mensajes_directos (remitente_id, destinatario_id, contenido, fecha, leido) VALUES
(2, 1, '¿Viste lo del TP?',                       CURRENT_TIMESTAMP - INTERVAL '3 hours',    TRUE),
(1, 2, 'Sí, mañana lo terminamos.',               CURRENT_TIMESTAMP - INTERVAL '2 hours',    TRUE),
(2, 1, 'Dale, te paso el diagrama a la noche 👍', CURRENT_TIMESTAMP - INTERVAL '1 hour',     FALSE),
(3, 1, '¿Jugamos hoy?',                           CURRENT_TIMESTAMP - INTERVAL '30 minutes', FALSE);

-- REACCIONES Y FIJADOS ------------------------------------------------
INSERT INTO reacciones (mensaje_id, usuario_id, emoji) VALUES
(1, 2, '👋'), (1, 3, '👋'), (1, 4, '🎉'), (3, 2, '👍'), (7, 1, '🔥'), (10, 1, '🎮');
UPDATE mensajes SET fijado = TRUE WHERE id IN (1, 3);

-- ENCUESTA (se publica como un mensaje del canal #general) ------------
INSERT INTO mensajes (canal_id, autor_id, contenido, fecha) VALUES
(1, 2, '¿Qué día hacemos la juntada?', CURRENT_TIMESTAMP - INTERVAL '6 hours');
INSERT INTO encuestas (mensaje_id, multiple, fecha_limite)
SELECT id, FALSE, CURRENT_TIMESTAMP + INTERVAL '2 days' FROM mensajes WHERE contenido = '¿Qué día hacemos la juntada?';
INSERT INTO opciones_encuesta (encuesta_id, texto, orden)
SELECT e.id, o.texto, o.orden FROM encuestas e
CROSS JOIN (VALUES ('Viernes', 0), ('Sábado', 1), ('Domingo', 2)) AS o(texto, orden);
INSERT INTO votos_encuesta (encuesta_id, opcion_id, usuario_id)
SELECT o.encuesta_id, o.id, v.usuario_id FROM opciones_encuesta o
JOIN (VALUES ('Sábado', 1), ('Sábado', 3), ('Viernes', 4)) AS v(texto, usuario_id) ON v.texto = o.texto;

-- PUBLICACIONES -------------------------------------------------------
INSERT INTO publicaciones (autor_id, servidor_id, contenido, fecha) VALUES
(1, NULL, '¡Terminé el curso de Python! 🐍',                    CURRENT_TIMESTAMP - INTERVAL '2 days'),
(2, NULL, 'Hoy se juega el clásico. ¿Quién gana?',              CURRENT_TIMESTAMP - INTERVAL '1 day'),
(1, 1,    'Recuerden traer la compu el jueves para el repaso.', CURRENT_TIMESTAMP - INTERVAL '5 hours');
INSERT INTO publicacion_likes (publicacion_id, usuario_id) VALUES (1, 2), (1, 3), (2, 1);
INSERT INTO publicacion_comentarios (publicacion_id, autor_id, contenido) VALUES
(1, 2, '¡Felicitaciones!'), (2, 1, 'Obvio que nosotros 😎');

-- ESTADOS (duran 24 horas) --------------------------------------------
INSERT INTO estados (usuario_id, contenido, color_fondo, fecha, vence) VALUES
(2, 'Estudiando para el parcial 📚', '#3d9be8', CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP + INTERVAL '22 hours'),
(3, 'Stream esta noche 🎮',          '#7c5cff', CURRENT_TIMESTAMP - INTERVAL '1 hour',  CURRENT_TIMESTAMP + INTERVAL '23 hours');

-- CALENDARIO ----------------------------------------------------------
INSERT INTO eventos (servidor_id, creador_id, titulo, descripcion, lugar, inicio, fin) VALUES
(1, 1, 'Repaso para el parcial', 'Traigan dudas.', 'sala-de-estudio',
   date_trunc('day', CURRENT_TIMESTAMP) + INTERVAL '2 days 18 hours', date_trunc('day', CURRENT_TIMESTAMP) + INTERVAL '2 days 20 hours'),
(1, 2, 'Entrega del proyecto', '', '', date_trunc('day', CURRENT_TIMESTAMP) + INTERVAL '9 days 23 hours', NULL),
(3, 3, 'Torneo de Rocket League', 'Equipos de a 2.', 'partidas',
   date_trunc('day', CURRENT_TIMESTAMP) + INTERVAL '4 days 21 hours', NULL);
INSERT INTO evento_asistentes (evento_id, usuario_id) VALUES (1, 1), (1, 2), (1, 3), (2, 2), (3, 3), (3, 1);

-- TAREAS --------------------------------------------------------------
INSERT INTO tareas (servidor_id, creador_id, asignado_id, titulo, descripcion, fecha_limite, estado, fecha_completada, puntos) VALUES
(1, 1, 2,    'Diagrama de clases',    'Usar draw.io', CURRENT_TIMESTAMP + INTERVAL '3 days', 'en_progreso', NULL, 0),
(1, 1, 3,    'Armar la presentación', '',             CURRENT_TIMESTAMP + INTERVAL '5 days', 'pendiente',   NULL, 10),
(1, 2, 4,    'Probar los endpoints',  'Con Swagger',  CURRENT_TIMESTAMP - INTERVAL '1 day',  'hecha',       CURRENT_TIMESTAMP - INTERVAL '1 day', 0),
(1, 1, NULL, 'Conseguir proyector',   '',             NULL,                                  'pendiente',   NULL, 5);

-- SCOREBOARD ----------------------------------------------------------
INSERT INTO puntos (servidor_id, usuario_id, otorgado_por, cantidad, motivo) VALUES
(1, 3, 2,    10, 'Ayudó con las FK compuestas'),
(1, 4, 1,     5, 'Primera entrega a tiempo'),
(3, 1, NULL,  3, 'Ganó ta-te-ti en una llamada');

-- SERVIDOR TEMPORAL (se borra solo en 3 días) -------------------------
INSERT INTO servidores (nombre, duenio_id, fecha_creacion, expira_en) VALUES
('Juntada del sábado', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '3 days'); -- id 6
INSERT INTO canales (servidor_id, nombre, tipo) VALUES (6, 'general', 'texto');
INSERT INTO roles (servidor_id, nombre, puede_escribir) VALUES (6, '@everyone', TRUE);
INSERT INTO miembros (usuario_id, servidor_id) VALUES (1, 6), (2, 6);
INSERT INTO roles_miembro (usuario_id, rol_id)
SELECT m.u, r.id FROM roles r CROSS JOIN (VALUES (1), (2)) AS m(u) WHERE r.servidor_id = 6;
INSERT INTO historial_servidores (usuario_id, servidor_id, servidor_nombre) VALUES
(1, 6, 'Juntada del sábado'), (2, 6, 'Juntada del sábado');
