# Guía de Despliegue Local - Fortalecer Análisis con Clausulados

## Requisitos Previos

- Node.js 18+
- npm o yarn
- Cuenta en Supabase (para base de datos)
- API Key de Google Gemini

## 1. Instalación de Dependencias

```bash
# En la raíz del proyecto
npm install

# En el directorio server
cd server && npm install
```

## 2. Configuración de Variables de Entorno

Crear archivo `server/.env`:

```env
# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
SUPABASE_ANON_KEY=tu_anon_key

# Gemini
GEMINI_API_KEY=tu_gemini_api_key
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

# Configuración
PORT=8080
NODE_ENV=development
```

## 3. Base de Datos Local

### Opción A: Supabase Local (Recomendado)

```bash
# Instalar Supabase CLI si no lo tienes
npm install -g supabase

# Iniciar Supabase local
supabase start

# Ejecutar migraciones
supabase migration up
```

### Opción B: PostgreSQL Local

```bash
# Crear base de datos
createdb comparador_csa

# Ejecutar migraciones manualmente
psql -d comparador_csa -f server/supabase/migrations/001_initial_schema.sql
psql -d comparador_csa -f server/supabase/migrations/002_vector_functions.sql
# ... ejecutar todas las migraciones
```

## 4. Compilación del Proyecto

```bash
# En la raíz
npm run build

# O paso a paso:
npm run build:frontend  # Compila React
npm run build:backend   # Compila TypeScript
```

## 5. Iniciar Servidores

### Terminal 1 - Backend:
```bash
cd server
npm run dev
# o
npm run server:dev
```

El backend estará en: http://localhost:8080

### Terminal 2 - Frontend:
```bash
# En la raíz
npm run dev
```

El frontend estará en: http://localhost:3000

## 6. Verificar que todo funciona

```bash
# Health check
curl http://localhost:8080/health

# Debería responder:
# {"status":"ok","message":"CSA Comparator API is running"}
```

## 7. Probar Nuevos Endpoints

### Test Fase 1: Validación de Coberturas
```bash
curl -X POST http://localhost:8080/api/analysis/validate-coverages \
  -H "Content-Type: application/json" \
  -d '{
    "quote": {
      "insurerName": "Seguros Bolívar",
      "coverages": [
        {"name": "Incendio", "value": "500M", "deductible": "10%"},
        {"name": "RC", "value": "100M", "deductible": "5 SMMLV"}
      ]
    },
    "insurerName": "Seguros Bolívar"
  }'
```

### Test Fase 2: Riesgo de Deducible
```bash
curl -X POST http://localhost:8080/api/analysis/deductible-risk \
  -H "Content-Type: application/json" \
  -d '{
    "coverageName": "Incendio",
    "quoteDeductible": "10%",
    "clauseDeductible": "10% / Máx. 500 SMMLV",
    "insuredAmount": 500000000
  }'
```

### Test Fase 3: Contextualización
```bash
curl -X POST http://localhost:8080/api/analysis/contextualize \
  -H "Content-Type: application/json" \
  -d '{
    "exclusions": ["No cubre inundación en zonas costeras"],
    "clientProfile": {
      "industryType": "manufactura",
      "locationZone": "costera",
      "locationCity": "Cartagena",
      "hasSingleSupplier": false,
      "employeeCount": 50,
      "buildingType": "propio",
      "primaryActivity": "Fabricación"
    }
  }'
```

### Test Fase 4: Opinión Legal
```bash
curl -X POST http://localhost:8080/api/analysis/legal-opinion \
  -H "Content-Type: application/json" \
  -d '{
    "quote": {
      "insurerName": "Seguros Bolívar",
      "coverageName": "Responsabilidad Civil",
      "value": "500M",
      "deductible": "5%"
    },
    "clientProfile": {
      "industryType": "manufactura",
      "locationZone": "urbana",
      "locationCity": "Bogotá",
      "hasSingleSupplier": false,
      "employeeCount": 150,
      "buildingType": "arrendado",
      "primaryActivity": "Alimentos"
    },
    "insurerName": "Seguros Bolívar"
  }'
```

## 8. Probar Análisis Completo (Flujo Principal)

```bash
# Usar cotizaciones de ejemplo
curl -X POST http://localhost:8080/api/analyze \
  -F "quotes=@Ejemplos/cotizacion-prueba.pdf"

# O con múltiples cotizaciones
curl -X POST http://localhost:8080/api/analyze \
  -F "quotes=@Ejemplos/cotizacion1.pdf" \
  -F "quotes=@Ejemplos/cotizacion2.pdf" \
  -F "clauses=@Ejemplos/clausulado-aseguradora.pdf"
```

## 9. Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests específicos
npm test -- clauseCoverageValidator
npm test -- deductibleAnalyzer
npm test -- contextualRiskAnalyzer

# Con cobertura
npm test -- --coverage

# Modo watch (para desarrollo)
npx vitest
```

## 10. Solución de Problemas Comunes

### Error: "Cannot connect to Supabase"
- Verificar que las variables de entorno están correctas
- Verificar que Supabase está corriendo: `supabase status`

### Error: "Gemini API key not found"
- Verificar que `GEMINI_API_KEY` está en `server/.env`
- O que `VITE_GEMINI_API_KEY` está en `.env.local`

### Error: "Port already in use"
- Cambiar el puerto en `server/.env`: `PORT=8081`
- O matar el proceso: `kill $(lsof -t -i:8080)`

### Error de CORS
- Verificar que el frontend está en `http://localhost:3000`
- Verificar que `cors` está configurado en `server/src/index.ts`

## 11. Datos de Prueba

Usar los mocks en `server/src/services/__tests__/__fixtures__/`:

```bash
# Cotización mock para testing
curl -X POST http://localhost:8080/api/analysis/validate-coverages \
  -H "Content-Type: application/json" \
  -d @server/src/services/__tests__/__fixtures__/mock-quote.json
```

## 12. Verificación Visual

1. Abrir http://localhost:3000
2. Seleccionar cliente
3. Subir cotizaciones
4. Verificar que aparecen las nuevas métricas:
   - Validación de coberturas
   - Riesgo de deducibles
   - Análisis contextual (si hay perfil)
   - Indicadores de cumplimiento

## 13. Logs y Debugging

```bash
# Ver logs del backend
cd server && npm run dev 2>&1 | tee backend.log

# Ver logs específicos
grep "clauseCoverageValidator" backend.log
grep "deductibleAnalyzer" backend.log
```
