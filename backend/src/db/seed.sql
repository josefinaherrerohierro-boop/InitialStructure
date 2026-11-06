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
