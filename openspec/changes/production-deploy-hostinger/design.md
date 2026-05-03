## Context

El proyecto Comparador de Seguros PYME es una aplicación full-stack que permite a agentes de seguros comparar cotizaciones de aseguradoras. Actualmente funciona solo en localhost con:

- **Frontend**: React 19 + Vite (puerto 3000)
- **Backend**: Express.js + TypeScript (puerto 8080)
- **AI**: Gemini API para extracción y análisis
- **Database**: Supabase (PostgreSQL)
- **Procesamiento**: PDF extraction, semantic matching (4 capas), RAG

El sistema tiene 5 usuarios beta esperando acceso desde cualquier dispositivo. El deploy debe ser en Hostinger Node.js con dominio comparadorpyme.baconhacks.com.

## Goals / Non-Goals

**Goals:**
- Unificar frontend y backend en una sola aplicación Node.js
- Deploy automático desde GitHub a Hostinger
- Autenticación segura con Supabase Auth para 5 usuarios beta
- Almacenamiento eficiente: cotizaciones temporales en /tmp, clausulados en Supabase Storage
- Repo limpio sin archivos de desarrollo (tests, debug, docs)
- SSL y dominio personalizado funcionando

**Non-Goals:**
- No CI/CD automatizado con GitHub Actions (deploy manual por ahora)
- No migración de datos existentes (fresh start en producción)
- No optimización de performance avanzada (MVP primero)
- No múltiples instancias o load balancing
- No backup automatizado (Supabase maneja backups de DB)

## Decisions

### 1. Unificación Frontend + Backend en un solo proceso
**Decision**: Servir frontend React como static files desde Express en lugar de correr como app separada.

**Rationale**:
- Hostinger Node.js corre un solo proceso
- Elimina CORS y problemas de cross-origin
- Un solo dominio, un solo SSL certificate
- Más simple para 5 usuarios beta

**Alternatives considered**:
- Frontend en Hostinger static hosting + Backend en Node.js: Más complejo, dos configs
- Frontend en Vercel/Netlify + Backend en Hostinger: CORS necesario, más puntos de fallo

### 2. Supabase Auth en lugar de Auth propia
**Decision**: Usar Supabase Auth para autenticación.

**Rationale**:
- Ya tenemos Supabase configurado para DB
- Reduce código de auth a mantener
- JWT tokens listos para usar
- Email confirmation built-in
- Gratis para 5 usuarios

**Alternatives considered**:
- Auth0: Costo adicional, overkill para 5 usuarios
- Firebase Auth: Otra dependencia, no aprovechamos Supabase existente
- Auth propia: Más código, riesgos de seguridad

### 3. Almacenamiento de cotizaciones en /tmp (efímero)
**Decision**: Los PDFs de cotizaciones se procesan y eliminan inmediatamente.

**Rationale**:
- Las cotizaciones no necesitan persistir después del análisis
- Reduce costo de almacenamiento
- /tmp es estándar en Node.js/Hostinger
- Elimina problemas de acumulación de archivos

**Alternatives considered**:
- Supabase Storage para todo: Costo innecesario para archivos temporales
- Almacenamiento local persistente: Se pierde en reinicios de Hostinger
- Cloud Storage (S3): Overkill y costo adicional

### 4. Estructura de repo con dos package.json
**Decision**: Mantener package.json separados para frontend y backend con uno raíz que los orquesta.

**Rationale**:
- Claridad de dependencias (frontend no necesita Express, backend no necesita React)
- Build independiente permite optimizaciones
- Facilita testing separado en desarrollo

**Alternatives considered**:
- Un solo package.json: Mezcla de dependencias, confusión
- Workspaces (npm/pnpm): Más complejo para Hostinger

### 5. Eliminación de tests y scripts de debug
**Decision**: Excluir tests, mocks, scripts debug, y documentación de desarrollo del repo de producción.

**Rationale**:
- Repo más pequeño y rápido de clonar
- Sin dependencias de desarrollo en producción
- Menos superficie de ataque
- Más claro qué es código de producción

**Alternatives considered**:
- Incluir todo y filtrar en .gitignore: Más complejo, errores posibles
- Rama production con filter: Más complejo de mantener

## Risks / Trade-offs

### Riesgo: Cold starts en Hostinger
**Riesgo**: Si Hostinger "duerme" la app por inactividad, el primer request puede tardar.
**Mitigación**: Hostinger Node.js generalmente mantiene apps activas. Si ocurre, es aceptable para 5 usuarios beta.

### Riesgo: Límites de Supabase (free tier)
**Riesgo**: Supabase free tier tiene límites de requests/storage.
**Mitigación**: 5 usuarios beta no deberían exceder límites. Monitorear uso y upgradear si es necesario.

### Riesgo: Pérdida de archivos en /tmp
**Riesgo**: Si el servidor reinicia durante procesamiento, se pierde el PDF.
**Mitigación**: Procesamiento es síncrono y rápido (< 30 segundos). Si falla, usuario re-subirá.

### Riesgo: Dependencia de GitHub para deploy
**Riesgo**: Si GitHub está caído, no se puede deployar.
**Mitigación**: Aceptable para MVP. En el futuro se puede agregar CI/CD con fallback.

### Riesgo: Variables de entorno expuestas accidentalmente
**Riesgo**: Desarrollador puede commitear .env con valores reales.
**Mitigación**: .env está en .gitignore. .env.example solo tiene templates. Revisar en PR.

### Trade-off: Sin tests en producción
**Trade-off**: No se ejecutan tests automáticos antes de deploy.
**Mitigación**: Tests se ejecutan en desarrollo. Para MVP con 5 usuarios, riesgo aceptable.

## Migration Plan

### Paso 1: Preparación (antes de deploy)
1. Crear nuevo repo GitHub "ComparadorPYME" (vacío)
2. Configurar Supabase Auth (habilitar email/password, configurar dominios permitidos)
3. Verificar schema de Supabase está listo para producción
4. Preparar lista de 5 emails autorizados para beta

### Paso 2: Creación de repo limpio
1. Copiar archivos de producción (sin tests, debug, docs)
2. Crear package.json unificado
3. Modificar server/src/index.ts para servir frontend estático
4. Crear .env.example con templates
5. Verificar que npm run build funciona localmente

### Paso 3: Configuración Hostinger
1. Crear app Node.js en Hostinger panel
2. Conectar repo GitHub ComparadorPYME
3. Configurar variables de entorno (GEMINI_API_KEY, SUPABASE_*)
4. Configurar dominio comparadorpyme.baconhacks.com
5. Verificar SSL automático

### Paso 4: Deploy inicial
1. Push a rama main de ComparadorPYME
2. Hostinger detecta cambio y ejecuta build
3. Verificar que app inicia correctamente
4. Probar endpoints /health, /api/analyze

### Paso 5: Verificación
1. Probar autenticación con Supabase Auth
2. Subir cotización de prueba
3. Verificar análisis completo funciona
4. Confirmar con usuarios beta

### Rollback Strategy
- Hostinger permite revertir a commit anterior
- Alternativa: Mantener repo de desarrollo intacto como backup
- Supabase tiene backups automáticos de DB

## Open Questions

1. ¿Hostinger asigna puerto fijo o variable? (Afecta configuración de Express)
2. ¿Cuál es el límite de almacenamiento de Supabase free tier para Storage?
3. ¿Necesitamos rate limiting en Express o Hostinger lo maneja?
4. ¿Los usuarios beta necesitan diferentes niveles de permisos o todos iguales?
5. ¿Debemos incluir health checks o monitoreo básico?
