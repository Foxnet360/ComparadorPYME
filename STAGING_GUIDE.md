# Guía de Staging en Railway (Opción B)

## Objetivo
Crear un entorno de staging dentro del mismo proyecto de Railway para probar la extracción multimodal antes de pasar a producción.

## Requisitos Previos
- Cuenta en Railway (https://railway.app)
- CLI de Railway instalado: `npm install -g @railway/cli`
- Proyecto ya deployado en Railway

## Paso 1: Crear Branch `staging`

```bash
# Desde tu rama feature actual
git checkout -b staging
git push origin staging
```

## Paso 2: Crear Nuevo Servicio en Railway

1. Ve a tu dashboard de Railway: https://railway.app/dashboard
2. Selecciona tu proyecto actual
3. Click en **"New"** → **"Database"** o **"Empty Service"**
4. Selecciona **"Deploy from GitHub repo"**
5. Conecta tu repositorio
6. En **"Branch"** selecciona `staging`

## Paso 3: Configurar Variables de Entorno

En el servicio de staging, configura estas variables (diferentes a producción):

```env
# Database (usar una base de datos de test o la misma con prefijo staging_)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-key-staging

# Gemini (puedes usar la misma API key)
GEMINI_API_KEY=tu-api-key
GEMINI_MODEL=gemini-2.5-pro

# Feature Flags (Staging = testing)
ENABLE_MULTIMODAL_EXTRACTION=true
NODE_ENV=staging

# Opcional: Base de datos separada para staging
# DATABASE_URL=postgresql://...staging
```

## Paso 4: Configurar Nombre del Servicio

Cambia el nombre del servicio a algo descriptivo:
- Click en el servicio → Settings → Name
- Sugerencia: `comparador-csa-staging`

## Paso 5: Deploy Automático

Railway hará deploy automático cada vez que hagas push a la branch `staging`.

```bash
# Para deployar cambios a staging
git checkout staging
git merge feature/multimodal-quote-extraction-v2
git push origin staging
```

## Paso 6: Verificar Deploy

```bash
# Obtener URL del servicio de staging
railway status

# Hacer health check
curl https://tu-url-staging.railway.app/health
```

## Paso 7: Probar Comparación V1 vs V2

Usa el endpoint de comparación:
```bash
curl -X POST https://tu-url-staging.railway.app/api/compare-extraction \
  -F "quotes[]=@/ruta/a/cotizacion.pdf" \
  -F "insurerName=HDI"
```

## Estructura de Branches

```
main (producción - estable)
  ↑
staging (pre-producción - testing)
  ↑
feature/multimodal-quote-extraction-v2 (desarrollo)
```

## Promoción a Producción

Cuando todo esté verificado en staging:

```bash
# Crear PR de staging → main
git checkout main
git merge staging
git push origin main
```

Railway hará deploy automático a producción.

## Rollback (Si algo falla)

```bash
# Revertir en main
git revert HEAD
git push origin main

# O volver a un commit específico
git checkout main
git reset --hard b474759  # Commit anterior estable
git push origin main --force
```

## Comandos Útiles

```bash
# Ver logs de staging
railway logs --service comparador-csa-staging

# Variables de entorno
railway variables --service comparador-csa-staging

# Restart servicio
railway restart --service comparador-csa-staging
```

## Checklist Pre-Deploy a Producción

- [ ] Tests pasan en staging
- [ ] Comparación V1 vs V2 muestra mejora
- [ ] Tiempos de extracción < 5 minutos
- [ ] No hay errores en logs
- [ ] Feature flag funciona correctamente
- [ ] Rollback plan listo
