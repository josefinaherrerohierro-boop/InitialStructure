# Initial Structure — FastAPI + SQLAlchemy + Pydantic

Estructura base de un proyecto en capas (routers, services, repositories, models, schemas, dtos, mappers, middlewares).

## Importante: este repo es un TEMPLATE

**No clones este repo directamente ni intentes pushear.** El repo está protegido y solo el docente tiene permisos de escritura.

### Cómo trabajar con esta plantilla

1. Entrá al repo en GitHub.
2. Hacé click en el botón verde **"Use this template" → "Create a new repository"** (o, si no aparece, usá **"Fork"**).
3. Creá el nuevo repo en **tu cuenta personal** de GitHub.
4. Cloná **tu copia** (no la del docente):
   ```bash
   git clone https://github.com/<TU_USUARIO>/<TU_REPO>.git
   cd <TU_REPO>
   ```
5. A partir de ahí trabajás libremente sobre tu propio repo.

> Si intentás `git push` y te dice `permission denied`, es porque clonaste el repo del docente en lugar de tu fork/template. Volvé al paso 2.

---

## Setup

```bash
python -m venv venv
source venv/bin/activate          # Linux/Mac
# venv\Scripts\Activate.ps1       # Windows

pip install -r requirements.txt
cp .env.example .env               # editá con tus credenciales

uvicorn src.app:app --reload
```

Abrir http://localhost:8000/docs para ver Swagger.

---

## Estructura de carpetas

```
src/
├── db/
│   ├── connection.py
│   ├── models/          # SQLAlchemy
│   ├── migrations/      # Alembic
│   └── seeders/
├── schemas/             # Pydantic (validación HTTP)
├── dtos/                # Pydantic (transporte entre capas)
├── mappers/             # Model ⇄ DTO
├── repositories/        # queries
├── services/            # lógica de negocio
├── routers/             # endpoints FastAPI
├── middlewares/
├── config/
├── utils/
├── app.py               # crea app FastAPI
└── main.py              # entry point
```

---

## Cómo está pensada la entrega

El módulo de **users** tiene un endpoint completo (`POST /users`) con todas las capas implementadas como ejemplo de la sintaxis.

El resto de los métodos (`GET`, `PUT`, `DELETE`) y los demás dominios (`products`, `auth`) están con `...` / `pass` / comentarios `TODO`. **Tu trabajo es completarlos** siguiendo el patrón del ejemplo.

---

## Reglas de la arquitectura

1. `routers` no tocan la BD.
2. `services` no tocan `Request` / `Response`.
3. `repositories` no tienen lógica de negocio.
4. `models` no salen del repository / service.
5. `schemas` solo en routers.
6. Al cliente siempre va un DTO, nunca un Model.


---

## Kort v2: funciones nuevas

### Cómo actualizar tu copia

1. Instalá la dependencia nueva (sirve para subir archivos):
   ```bash
   pip install -r requirements.txt
   ```
2. Actualizá la base de datos. Hay dos opciones:
   - **Conservar tus datos:** en pgAdmin, ejecutá `src/db/migracion_v2.sql` una vez. Solo agrega columnas y tablas; no borra nada.
   - **Empezar de cero:** ejecutá `src/db/tables.sql` y después `src/db/seed.sql`. El seed ahora trae ejemplos de todo lo nuevo: amigos, mensajes directos, encuesta, eventos, tareas, puntos, estados y un servidor temporal.
3. Los archivos que suben los usuarios se guardan en `backend/uploads/`. Esa carpeta no se sube a git.

### Qué hay de nuevo

| Bloque | Funciones | Endpoints principales |
|---|---|---|
| Archivos | Subir imágenes, audios, videos y documentos (hasta 15 MB) | `POST /api/archivos` (se sirven en `/uploads/...`) |
| Chat | Adjuntos, notas de voz, links con vista previa, reacciones, fijados, búsqueda, multimedia y encuestas (con fecha límite o sin) | `POST /api/mensajes/{id}/reacciones`, `POST/DELETE /api/mensajes/{id}/fijar`, `GET /api/canales/{id}/fijados`, `GET /api/servidores/{id}/buscar?q=`, `GET /api/servidores/{id}/multimedia?tipo=`, `POST /api/canales/{id}/encuestas`, `POST /api/encuestas/{id}/votar` |
| Social | Amigos, mensajes directos, perfil (bio, etiquetas, redes, varias fotos), apodos e historial de servidores | `/api/amigos`, `/api/mensajes-directos`, `/api/perfiles/{id}`, `/api/perfiles/me/...`, `PUT /api/servidores/{id}/miembros/{uid}/apodo` |
| Publicaciones | Publicaciones del perfil y del servidor (me gusta y comentarios) y estados de 24 horas | `/api/publicaciones`, `/api/publicaciones/feed`, `/api/estados` |
| Organización | Calendario, tareas y scoreboard por servidor | `/api/servidores/{id}/eventos`, `/api/servidores/{id}/tareas`, `/api/servidores/{id}/scoreboard`, `/api/servidores/{id}/puntos` |
| Servidores | Orden personalizado y servidores temporales que se borran solos | `PUT /api/usuarios/me/servidores/orden`, `duracion_horas` al crear o editar un servidor |
| Apariencia | Tema, color principal, tipografía, tamaño de letra y modo compacto | `GET/PUT /api/preferencias` |
| Llamadas | Video, compartir pantalla, pizarra y juegos (ta-te-ti, piedra-papel-tijera) | Por el WebSocket `/api/ws/voz/{canal_id}` (mensajes `estado`, `pizarra` y `juego`) |
| Wrapped | Resumen del año tipo Spotify | `GET /api/perfiles/me/wrapped?anio=` |

Todos los endpoints están documentados en Swagger (`/docs`).

### Cosas para tener en cuenta

- **Actualización del chat:** se sigue usando consulta cada 3 segundos, igual que antes. Solo las llamadas usan WebSocket.
- **Limpieza automática:** una tarea de fondo (ver `app.py`) borra cada minuto los servidores temporales vencidos y los estados de más de 24 horas.
- **Juegos:** el servidor arbitra los juegos, así que no se puede hacer trampa desde el navegador. Quien gana suma puntos al scoreboard (3 en ta-te-ti, 2 en piedra-papel-tijera).
- **Video entre redes distintas:** la llamada usa un servidor STUN público. Entre dos redes muy restrictivas (algunas redes de escuela o de empresa) puede hacer falta un servidor TURN.
