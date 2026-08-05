# Redirect URLs para Supabase Auth (candeApp en Vercel)

## 1. Encuentra tu URL de Vercel

Vercel → tu proyecto → **Domains**

Ejemplos típicos:
- `https://cande-app.vercel.app`
- `https://cande-app-margaritasouviron.vercel.app`

Copia la URL **exacta** que ves ahí (con `https://`).

---

## 2. Supabase → Authentication → URL Configuration

### Site URL
Pega tu URL de Vercel **sin** barra final:

```
https://TU-APP.vercel.app
```

### Redirect URLs
Añade **cada línea por separado** (botón Add URL):

```
https://TU-APP.vercel.app/**
http://localhost:8081/**
```

Sustituye `TU-APP` por tu dominio real de Vercel.

> Para login con email + contraseña las redirect URLs evitan errores si Supabase redirige tras confirmar email. No afectan tanto el login normal, pero conviene tenerlas.

---

## 3. Vercel → Environment Variables

| Name | Value (ejemplo) |
|------|-----------------|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://puphhkaqbvruupoxlcuh.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` (JWT largo, ~200+ caracteres) |

**NO uses** los valores de `.env.example`:
- ❌ `your-project.supabase.co`
- ❌ `your-anon-key`

Obtén los reales en **Supabase → Settings → API**:
- Project URL
- anon public (no service_role)

Marca **Production**, **Preview**, **Development**.

---

## 4. Redeploy obligatorio

Deployments → ⋮ → **Redeploy**

Sin redeploy el bundle viejo sigue sin las claves.

---

## 5. Comprobar

Tras redeploy, en login **no** debe aparecer el cartel amarillo.

Si aparece, lee el texto: ahora muestra si la URL/key están vacías o son placeholders.
