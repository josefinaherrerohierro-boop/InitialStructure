# Kort — Frontend

Interfaz web de **Kort** hecha con **Next.js (App Router) + TypeScript + Tailwind CSS**.
La base se generó con **v0** a partir de un prompt con la identidad de Kort y la
lista exacta de endpoints de la API; la configuración del servidor
(`components/kort/config/`) y la cuenta (`components/kort/cuenta-modal.tsx`)
se agregaron a mano siguiendo el mismo estilo.

## Cómo correrlo

Requisitos: Node.js (LTS) y la API del backend corriendo en `http://localhost:8000`.

```bash
cd frontend
npm install        # solo la primera vez
npm run dev
```

Abrir http://localhost:3000

> La URL de la API se puede cambiar con la variable `NEXT_PUBLIC_API_URL`
> (por defecto `http://localhost:8000/api`). El backend solo acepta pedidos
> desde `http://localhost:3000` (CORS, variable `FRONTEND_URL` del backend).

## Estructura

```
app/
├── login/ y registro/        # pantallas de acceso (HU1)
├── app/                      # pantalla principal (servidores, canales, chat, miembros)
└── invitacion/[codigo]/      # unirse con un link de invitación (HU6)
components/kort/
├── app-shell.tsx             # arma la pantalla principal y carga los datos
├── channel-list.tsx          # canales del servidor (HU3)
├── chat-panel.tsx            # mensajes con paginación y actualización cada 3 s (HU7, HU8)
├── modals.tsx                # crear servidor, unirme, crear canal, invitar (HU2, HU3, HU5, HU6)
├── members-panel.tsx         # lista de miembros con roles
├── cuenta-modal.tsx          # mi cuenta (editar / borrar)
└── config/                   # configuración del servidor
    ├── general-tab.tsx       # nombre, salir, transferir, borrar (HU10)
    ├── canales-tab.tsx       # renombrar, solo lectura, borrar (HU3)
    ├── roles-tab.tsx         # crear y editar roles y permisos (HU4)
    ├── miembros-tab.tsx      # asignar roles, expulsar y banear (HU4, HU9)
    ├── invitaciones-tab.tsx  # ver y borrar invitaciones (HU5)
    └── estadisticas-tab.tsx  # top usuarios, canales inactivos y crecimiento (HU11, HU12)
lib/
├── api.ts                    # TODAS las llamadas a la API (un solo lugar)
└── kort.ts                   # permisos, colores, fechas
```

## Seguridad

Los botones se muestran u ocultan según los permisos del usuario (`lib/kort.ts`,
función `calcularPermisos`), pero **eso es solo comodidad visual**: el backend
vuelve a validar cada operación y, si no corresponde, responde 403 con un
mensaje que la interfaz muestra al usuario.
