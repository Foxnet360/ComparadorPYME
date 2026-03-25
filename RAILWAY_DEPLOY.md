# Deploy en Railway.app

## Paso 1: Preparar el Backend

### 1.1 Subir a GitHub
Asegúrate de que tu código esté en GitHub (ya está en: https://github.com/EquipoLogico/comparador-csa)

### 1.2 Crear proyecto en Railway

1. Ve a https://railway.app
2. Crea una cuenta (puedes usar GitHub para login)
3. Click en "New Project"
4. Selecciona "Deploy from GitHub repo"
5. Selecciona `EquipoLogico/comparador-csa`

### 1.3 Configurar el Servicio

Railway detectará automáticamente que es un proyecto Node.js. Sin embargo, debemos especificar el directorio raíz:

1. En el dashboard de Railway, ve a tu proyecto
2. Selecciona el servicio ( aparecerá como "comparador-csa" )
3. Ve a "Settings" → "Source directory"
4. Escribe: `server`
5. Click "Save"

### 1.4 Variables de Entorno

Ve a la pestaña "Variables" y agrega estas variables:

**Obligatorias:**
```
GEMINI_API_KEY=AIzaSyBzvycI9jwp21ohcJyl3bKcPzFqSTrL7Z0
SUPABASE_URL=https://nubiecwypgfekhvaffxm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51YmllY3d5cGdmZWtodmFmZnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQwODEyNCwiZXhwIjoyMDg5OTg0MTI0fQ.yJVMLIPSs2llvTh2UHMyIHmT9NJkC80yEfhgIetgwo4
PORT=8080
NODE_ENV=production
```

**Opcionales:**
```
GEMINI_MODEL=models/gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=models/gemini-embedding-001
CLAUSE_PAGES_BUCKET=clause-pages
REGION=CO
SMMLV_VALUE=1300000
UVT_VALUE=42412
CURRENCY=COP
```

### 1.5 Deploy

1. Railway hará deploy automáticamente
2. Espera a que termine (estado "Success")
3. Ve a "Settings" → "Domain"
4. Copia la URL (ej: `https://comparador-csa-production.up.railway.app`)

## Paso 2: Preparar el Frontend

### 2.1 Configurar URL del Backend

Crea un archivo `.env.production` en la raíz del proyecto (no en /server):

```bash
# /media/equipo-logico/C4366B84366B7678/workspace/Comparador_CSA/.env.production
VITE_API_URL=https://TU_URL_DE_RAILWAY.app/api
```

**Reemplaza** `TU_URL_DE_RAILWAY` con la URL que copiaste del paso 1.5

### 2.2 Build para producción

```bash
npm install
npm run build
```

Esto creará la carpeta `dist/` con los archivos optimizados.

### 2.3 Subir a Hostinger

1. Accede a tu File Manager en Hostinger
2. Ve a `public_html/` (o la carpeta de tu dominio)
3. Borra TODO el contenido anterior
4. Sube el contenido de la carpeta `dist/`:
   - `index.html`
   - Carpeta `assets/`

## Paso 3: Verificar

1. Accede a tu dominio de Hostinger
2. Prueba las funcionalidades:
   - Login
   - Nuevo Análisis
   - Ver Historial

## Solución de Problemas

### Error 404 en APIs
Verifica que `VITE_API_URL` esté configurado correctamente en `.env.production`

### Error CORS
El backend ya tiene CORS configurado, pero si ves errores, verifica que la URL de Hostinger esté permitida.

### Variables no cargan
Asegúrate de que las variables en Railway estén exactamente como se indican arriba (sin comillas, sin espacios extra).

## Comandos Útiles (para Railway CLI)

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link proyecto
railway link

# Ver logs
railway logs

# Redeploy
railway up
```
