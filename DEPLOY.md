# Guía de Despliegue en Railway

## Despliegue Automático

Este proyecto usa Docker multi-stage build en Railway. El proceso es automático:

1. Haz `git push` a la rama principal
2. Railway detecta el cambio
3. Construye frontend y backend dentro del contenedor
4. Despliega la aplicación

**No necesitas compilar localmente antes de pushear.**

---

## Variables de Entorno Requeridas

Configura estas variables en el [dashboard de Railway](https://railway.app):

### Backend (Runtime)
- `GEMINI_API_KEY` - API key de Google Gemini
- `SUPABASE_URL` - URL de tu proyecto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key de Supabase
- `SUPABASE_ANON_KEY` - Anon key de Supabase
- `GROQ_API_KEY` - API key de Groq (opcional)
- `CLAUSE_PAGES_BUCKET` - Nombre del bucket (default: clause-pages)
- `REGION` - Código de región (default: CO)
- `SMMLV_VALUE` - Valor del salario mínimo (default: 1300000)
- `UVT_VALUE` - Valor UVT (default: 42412)
- `CURRENCY` - Moneda (default: COP)

### Frontend (Build Time)
- `VITE_GEMINI_API_KEY` - Mismo valor que GEMINI_API_KEY (usado durante build)

**Nota:** Railway inyecta estas variables automáticamente tanto en build time como en runtime.

---

## Arquitectura del Contenedor

```
┌─────────────────────────────────────┐
│         Railway Container           │
│                                     │
│  ┌─────────────┐  ┌─────────────┐  │
│  │  Frontend   │  │   Backend   │  │
│  │  (dist/)    │  │ (server/dist)│ │
│  └─────────────┘  └─────────────┘  │
│         │                │          │
│         └──── Express ───┘          │
│              Puerto 8080            │
└─────────────────────────────────────┘
```

- Express sirve el frontend estático en `/`
- Las APIs están disponibles en `/api/*`
- Health check en `/health`

---

## Desarrollo Local

### Sin Docker (recomendado para desarrollo)

**Terminal 1 - Backend:**
```bash
cd server
npm install
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm install
npm run dev
```

El frontend estará en `http://localhost:3000` con proxy al backend.

### Con Docker (para validar producción)

```bash
# Build
docker build -t comparador-csa .

# Run
docker run -p 8080:8080 --env-file .env comparador-csa
```

---

## Troubleshooting

### "Build failed: no such file or directory"
- Verifica que `dist/` y `server/dist/` NO estén en Git (deben construirse en Railway)
- Verifica que `.dockerignore` no excluya archivos fuente necesarios

### "Cannot find module"
- Verifica que `server/package.json` tenga todas las dependencias del backend
- Verifica que `package.json` raíz tenga las dependencias del frontend

### Variables de entorno no disponibles
- Verifica que estén configuradas en Railway Dashboard
- Verifica que el nombre coincida exactamente (case-sensitive)

### Frontend no carga (404)
- Verifica que `NODE_ENV=production` esté configurado
- Verifica que Express esté sirviendo archivos estáticos de `dist/`

---

## Rollback

Si el deploy falla:

1. **Opción rápida:** En Railway Dashboard → Deployments → Seleccionar deployment anterior → Redeploy
2. **Opción Git:** Revertir el commit en GitHub, Railway hará deploy automático del estado anterior

---

## Monitoreo

- **Logs:** Railway Dashboard → Logs
- **Health:** `https://tu-app.railway.app/health`
- **Métricas:** Railway Dashboard → Metrics

---

## Notas Importantes

- El primer build puede tardar 3-5 minutos (descarga de dependencias)
- Builds subsiguientes son más rápidos gracias a Docker layer caching
- No incluyas archivos `.env` en Git (están en `.gitignore` y `.dockerignore`)
- Los archivos compilados (`dist/`, `server/dist/`) NO deben estar en Git
