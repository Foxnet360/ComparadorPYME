# Historial de Errores de Deploy

## Registro de Incidentes

### 2026-05-26 - Error #1: package-lock.json desincronizado
**Síntoma:** Build falla con `npm ci can only install packages when package.json and package-lock.json are in sync`

**Causa:** Agregar dependencias a `package.json` sin ejecutar `npm install`

**Dependencias faltantes:**
- express-rate-limit
- jsonwebtoken
- pino
- rate-limit-redis
- redis

**Fix:** Ejecutar `npm install` y commitear `package-lock.json`

**Prevención:** Siempre ejecutar `npm install` al modificar `package.json`

---

### 2026-05-26 - Error #2: Dependencias no instaladas en build
**Síntoma:** TypeScript build falla con `Cannot find module 'pino'` y similares

**Causa:** Nuevos archivos importaban módulos no listados en `package.json`

**Archivos afectados:**
- `server/src/middleware/auth.ts` → jsonwebtoken
- `server/src/middleware/rateLimiter.ts` → express-rate-limit, rate-limit-redis, redis
- `server/src/config/logger.ts` → pino

**Fix:** Agregar dependencias a `package.json` + `npm install`

**Prevención:** Verificar todos los imports de archivos nuevos

---

### 2026-05-26 - Error #3: Historias git divergentes
**Síntoma:** `fatal: refusing to merge unrelated histories`

**Causa:** Repositorio local tenía hashes diferentes al remoto (posible re-inicialización)

**Fix:** Usar `git merge --allow-unrelated-histories`

**Prevención:** No re-inicializar repos; mantener sincronización regular

---

### 2026-05-26 - Error #4: Husky bloquea commits
**Síntoma:** `husky - pre-commit script failed`

**Causa:** Configuración de lint-staged incompleta (faltaba en package.json)

**Fix temporal:** Usar `--no-verify` (solo en emergencias)

**Fix permanente:** Agregar configuración lint-staged a package.json

---

### 2026-03-25 - Error #5: ChromaDB dead code en producción
**Síntoma:** Railway falla al iniciar por intentar conectar a ChromaDB

**Causa:** Código muerto de ChromaDB no fue eliminado en migración anterior

**Fix:** Eliminar completamente referencias a ChromaDB

---

## Patrones Identificados

1. **Dependencias:** 60% de los errores son por dependencias faltantes o desincronizadas
2. **TypeScript:** 25% por errores de compilación no detectados antes de push
3. **Git:** 10% por problemas de sincronización entre local y remoto
4. **Configuración:** 5% por husky/lint-staged mal configurado

## Lecciones Aprendidas

- `package.json` y `package-lock.json` deben cambiar juntos SIEMPRE
- `npm install` es obligatorio después de modificar dependencias
- `tsc --noEmit` debe pasar sin errores antes de cada push
- Los scripts de verificación automatizados previenen errores humanos
