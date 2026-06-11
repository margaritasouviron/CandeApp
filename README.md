# candeApp

Aplicación de gestión de cuidados en el hogar para una familia que coordina el cuidado diario de una niña con necesidades especiales. Interfaz completamente en **español (es-ES)** con formato de 24 horas.

## Stack

- Expo SDK 56 · React Native · TypeScript
- Expo Router (navegación basada en archivos)
- NativeWind (Tailwind CSS)
- Supabase (Auth + PostgreSQL + RLS)
- TanStack Query (con persistencia en AsyncStorage)
- Zod · date-fns (locale `es`)
- SQLite (cola de mutaciones offline)

## Roles

| Rol | Descripción |
|-----|-------------|
| **organizador** | La madre. Solo puede haber **una** organizadora activa (restricción en BD). |
| **enfermera** | Personal de enfermería que registra cuidados durante turnos activos. |

## Prerrequisitos

- Node.js 20+
- npm
- Cuenta en [Supabase](https://supabase.com)
- Expo Go (móvil) o Xcode / Android Studio (simuladores)

## Configuración de Supabase

### 1. Crear proyecto

1. Crea un proyecto en [supabase.com/dashboard](https://supabase.com/dashboard).
2. Anota la **URL** y la **anon key** (Settings → API).

### 2. Ejecutar migraciones

Opción A — CLI local:

```bash
npm install -g supabase
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

Opción B — SQL Editor:

Ejecuta en orden en el SQL Editor de Supabase:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_functions_triggers.sql`
4. `supabase/migrations/004_app_alerts_rpc.sql`
5. `supabase/seed.sql`

### 3. Desplegar Edge Function (invitar enfermeras)

```bash
supabase functions deploy invite-nurse
```

La función usa `SUPABASE_SERVICE_ROLE_KEY` (configurada automáticamente en Supabase Edge Functions).

### 4. Crear cuenta organizador

El **primer usuario** registrado en Auth se convierte automáticamente en `organizador` (trigger `handle_new_user`).

**Pasos:**

1. En Supabase Dashboard → Authentication → Users → **Add user**.
2. Introduce email y contraseña.
3. Confirma el email si es necesario.
4. El trigger crea el perfil con rol `organizador`.
5. Ejecuta `seed.sql` si aún no hay paciente.

> Solo puede existir una organizadora activa. Las enfermeras se crean desde la app (organizador) o mediante la Edge Function `invite-nurse`.

### 5. Auth settings

- Desactiva el registro público si lo deseas (Authentication → Providers → Email → deshabilitar "Enable sign ups") tras crear la organizadora.
- Configura la URL de redirección para recuperación de contraseña si usas web.

## Variables de entorno

Copia `.env.example` a `.env`:

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

Expo carga automáticamente variables con prefijo `EXPO_PUBLIC_`.

## Ejecutar la app

```bash
npm install
npx expo start
```

| Comando | Descripción |
|---------|-------------|
| `npx expo start` | Servidor de desarrollo |
| `npx expo start --ios` | Simulador iOS |
| `npx expo start --android` | Emulador Android |
| `npx expo start --web` | Navegador web |

Escanea el QR con **Expo Go** en tu dispositivo.

## Estructura del proyecto

```
app/           # Rutas Expo Router
src/
  components/  # UI, calendario, bitácora, turnos
  features/    # Lógica por dominio (auth, shifts, etc.)
  hooks/
  lib/         # Supabase, offline, i18n, fechas
  types/
supabase/
  migrations/  # Esquema, RLS, triggers
  functions/   # Edge Functions
  seed.sql
```

## Funcionalidades MVP

- Autenticación (login, recuperar contraseña)
- Panel con resumen del día y cuenta atrás de próxima dosis
- Calendario semanal/mensual con lista de viñetas por día
- Gestión de turnos (organizador)
- Bitácora de cuidados (comida, medicación, signos vitales, higiene, observaciones)
- Prescripciones y seguimiento de dosis
- Gestión de enfermeras (organizador)
- Auditoría (organizador)
- Notificaciones in-app
- Modo offline básico (cola SQLite + banner)
- Diseño responsive (tabs en móvil, sidebar en tablet ≥768px)

## Alertas automáticas

La app llama periódicamente al RPC `refresh_app_alerts()` (requiere migración `004`) para:

- Actualizar estados de turnos
- Detectar dosis omitidas/retrasadas (30 min de gracia)
- Generar notificaciones de turnos sin cobertura

También puedes programar este RPC con **pg_cron** en Supabase Pro:

```sql
SELECT cron.schedule('candeapp-alerts', '*/5 * * * *', $$SELECT refresh_app_alerts()$$);
```

## Offline

Cuando no hay conexión:

- TanStack Query sirve datos cacheados.
- Los nuevos registros de bitácora se encolan en SQLite con `idempotency_key`.
- Al reconectar, `syncEngine` sincroniza la cola automáticamente.
- Banner: *"Sin conexión — los cambios se guardarán al volver"*.

## Licencia

Privado — uso familiar.
