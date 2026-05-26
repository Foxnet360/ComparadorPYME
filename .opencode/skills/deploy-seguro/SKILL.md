# Skill: Deploy Seguro

## Descripción

Workflow completo para desplegar el Comparador PYME a producción sin errores. Basado en el análisis de todos los incidentes de deploy fallidos.

## Problemas Resueltos

### Historial de Errores
| # | Error | Causa | Solución |
|---|-------|-------|----------|
| 1 | `npm ci` falla por lock file desincronizado | Agregar deps a package.json sin `npm install` | Siempre ejecutar `npm install` y commitear package-lock.json |
| 2 | TypeScript build falla | Nuevos imports sin dependencias instaladas | Verificar `tsc --noEmit` antes de push |
| 3 | Historias git divergentes | Re-inicialización del repo local | Usar `--allow-unrelated-histories` con precaución |
| 4 | Husky bloquea commits | Configuración de lint-staged incompleta | Bypass con `--no-verify` solo en emergencias |
| 5 | Dependencias faltantes en Docker | package.json incompleto | Validar todos los imports antes de commit |

## Flujo de Trabajo

```
┌─────────────────────────────────────────────────────────────┐
│              FLUJO DE DEPLOY SEGURO                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. PREPARAR                                                │
│     └─▶ git status (verificar estado limpio)               │
│     └─▶ git pull origin main (sincronizar)                 │
│                                                             │
│  2. VERIFICAR DEPENDENCIAS                                  │
│     └─▶ Si modificaste package.json:                        │
│         └─▶ npm install (regenerar lock file)              │
│         └─▶ git add package-lock.json                      │
│                                                             │
│  3. COMPILAR                                                │
│     └─▶ cd server && npx tsc --noEmit                      │
│     └─▶ Si hay errores: CORREGIR ANTES DE CONTINUAR        │
│                                                             │
│  4. VALIDAR ARCHIVOS                                        │
│     └─▶ No commit de .env o credenciales                   │
│     └─▶ No archivos sin seguimiento importantes            │
│     └─▶ package-lock.json incluido si cambió package.json  │
│                                                             │
│  5. COMMIT                                                  │
│     └─▶ git add -A                                         │
│     └─▶ git commit -m "type: descripción"                  │
│     └─▶ Si husky falla: evaluar si es seguro bypass        │
│                                                             │
│  6. PUSH                                                    │
│     └─▶ git push origin main                               │
│     └─▶ Verificar en GitHub que el push llegó              │
│                                                             │
│  7. MONITOREAR RAILWAY                                      │
│     └─▶ Esperar 2-3 minutos                                │
│     └─▶ Verificar logs de build                            │
│     └─▶ Si falla: analizar errores y corregir              │
│                                                             │
│  8. VALIDAR PRODUCCIÓN                                      │
│     └─▶ curl https://tu-dominio/health                     │
│     └─▶ Probar funcionalidades críticas                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Checklist Obligatorio

### Antes de cada push:
```markdown
□ npm install ejecutado (si cambió package.json)
□ package-lock.json commiteado (si cambió package.json)
□ cd server && npx tsc --noEmit pasa sin errores
□ No hay archivos .env en staging
□ No hay credenciales hardcodeadas
□ Mensaje de commit descriptivo (type: descripción)
```

### Tipos de commit permitidos:
- `feat:` Nueva funcionalidad
- `fix:` Corrección de bug
- `refactor:` Cambio de código sin cambiar funcionalidad
- `docs:` Documentación
- `chore:` Tareas de mantenimiento
- `deploy:` Cambios específicos de deploy

## Script de Verificación

Ejecutar antes de cada push:

```bash
# .opencode/skills/deploy-seguro/scripts/pre-push-check.sh
chmod +x .opencode/skills/deploy-seguro/scripts/pre-push-check.sh
.opencode/skills/deploy-seguro/scripts/pre-push-check.sh
```

Este script verifica:
1. Sincronización de package.json y package-lock.json
2. Compilación TypeScript sin errores
3. Ausencia de archivos sensibles
4. Estado del repositorio

## Reglas de Oro

1. **NUNCA** modificar `package.json` sin ejecutar `npm install` inmediatamente
2. **SIEMPRE** incluir `package-lock.json` en el mismo commit que `package.json`
3. **SIEMPRE** verificar `tsc --noEmit` antes del push final
4. **NUNCA** hacer push si el build local falla
5. **NUNCA** commitear archivos `.env`, credenciales o secrets
6. **SIEMPRE** mantener main sincronizado con origin antes de push

## Manejo de Emergencias

### Si Railway falla después del push:
1. No entrar en pánico - Railway mantiene el último deploy exitoso
2. Revisar logs: `railway logs --project miraculous-blessing`
3. Identificar el error (build vs runtime)
4. Corregir en local
5. Commit + push del fix
6. Monitorear nuevo deploy

### Rollback manual:
```bash
# Revertir último commit
git revert HEAD
git push origin main
```

## Referencias

- [Historial de errores de deploy](./docs/errores-deploy.md)
- [Script de verificación](./scripts/pre-push-check.sh)
- [Workflow de GitHub Actions](../.github/workflows/pre-deploy.yml)
