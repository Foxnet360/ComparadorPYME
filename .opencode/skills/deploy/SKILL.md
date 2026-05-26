# Skill: Deploy Seguro v2.0 - Automatizado

## Descripción

Skill completo para deploy automatizado y seguro del Comparador PYME. El **Deploy Bot** ejecuta todas las verificaciones y tareas automáticamente, guiándote paso a paso.

## Historial de Errores Resueltos

| # | Error | Causa | Solución Implementada |
|---|-------|-------|---------------------|
| 1 | `npm ci` falla | package.json sin package-lock.json sincronizado | Script verifica y ejecuta `npm install` automáticamente |
| 2 | TypeScript build falla | Dependencias no instaladas o errores de código | Script compila y corrige errores comunes automáticamente |
| 3 | Historias git divergentes | Re-inicialización del repo | Script detecta y ofrece merge |
| 4 | Husky bloquea commits | Configuración incompleta | Script bypass en emergencias |
| 5 | Deploy sin verificación | Olvido de pasos manuales | Script obliga verificación antes de push |
| 6 | Credenciales en commits | Archivos .env accidentalmente commiteados | Script detecta y remueve automáticamente |

## Uso Rápido

### Modo Guiado (Recomendado)
```bash
.opencode/skills/deploy/scripts/deploy-bot.sh gui
```

### Modo Automático (Solo si todo está perfecto)
```bash
.opencode/skills/deploy/scripts/deploy-bot.sh auto
```

### Solo Verificar (Sin ejecutar cambios)
```bash
.opencode/skills/deploy/scripts/deploy-bot.sh check
```

## Flujo Automático

```
┌─────────────────────────────────────────────────────────────┐
│           🚀 DEPLOY BOT v2.0 - FLUJO AUTOMÁTICO             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PASO 1: VERIFICAR REPO                                     │
│     └─▶ ¿Estás en main?                                     │
│     └─▶ ¿Hay cambios para commitear?                       │
│     └─▶ [AUTO] Detiene si hay problemas                    │
│                                                             │
│  PASO 2: SINCRONIZAR REMOTO                                │
│     └─▶ git fetch origin main                              │
│     └─▶ Detecta commits remotos faltantes                  │
│     └─▶ [PREGUNTA] ¿Hacer pull?                            │
│                                                             │
│  PASO 3: DEPENDENCIAS                                       │
│     └─▶ ¿package.json modificado?                          │
│     └─▶ ¿package-lock.json sincronizado?                   │
│     └─▶ [AUTO] Ejecuta npm install si es necesario         │
│     └─▶ [AUTO] Agrega package-lock.json al staging         │
│                                                             │
│  PASO 4: COMPILAR                                          │
│     └─▶ cd server && npx tsc --noEmit                      │
│     └─▶ [AUTO] Corrige errores comunes (tsconfig)          │
│     └─▶ [AUTO] Reintenta compilación                       │
│     └─▶ Detiene si hay errores que no puede corregir      │
│                                                             │
│  PASO 5: SEGURIDAD                                         │
│     └─▶ Detecta archivos .env en staging                   │
│     └─▶ [AUTO] Los remueve del staging                     │
│     └─▶ Detecta credenciales hardcodeadas                  │
│     └─▶ [PREGUNTA] Confirmar si son reales                 │
│                                                             │
│  PASO 6: COMMIT Y PUSH                                     │
│     └─▶ Muestra resumen de cambios                         │
│     └─▶ [PREGUNTA] ¿Agregar archivos no staged?            │
│     └─▶ [PREGUNTA] Mensaje de commit                       │
│     └─▶ git commit -m "mensaje"                            │
│     └─▶ git push origin main                               │
│                                                             │
│  PASO 7: MONITOREAR RAILWAY                                │
│     └─▶ Espera 5 segundos                                  │
│     └─▶ Muestra últimos deployments                        │
│     └─▶ Espera 30 segundos                                 │
│     └─▶ Muestra estado final                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Características del Deploy Bot

### Verificaciones Automáticas
✅ **Rama:** Verifica que estés en `main`
✅ **Sincronización:** Detecta si hay cambios remotos que te faltan
✅ **Dependencias:** Ejecuta `npm install` si package.json cambió
✅ **Lock file:** Agrega automáticamente `package-lock.json` al staging
✅ **Compilación:** Corre `tsc --noEmit` y corrige errores comunes
✅ **Seguridad:** Detecta y remueve archivos `.env` accidentalmente staged
✅ **Credenciales:** Busca patrones de API keys en los cambios

### Correcciones Automáticas
🔧 **tsconfig.json:** Agrega `moduleResolution: node` si falta
🔧 **package-lock.json:** Regenera si está desincronizado
🔧 **Staging:** Remueve archivos sensibles automáticamente

### Interacción Inteligente
💬 **Modo gui:** Pregunta antes de cada acción importante
💬 **Modo auto:** Solo ejecuta si todo está perfecto
💬 **Modo check:** Solo verifica, no toca nada

## Ejemplos de Uso

### Ejemplo 1: Cambio Simple
```bash
# Editaste server/src/routes/chat.ts

# Ejecutar deploy bot
.opencode/skills/deploy/scripts/deploy-bot.sh gui

# El bot te preguntará:
# ➤ ¿Agregar todos los archivos al staging? [S/n]: S
# ➤ Mensaje de commit: fix: corregir typo en chat
# ➤ ¿Confirmar commit y push? [S/n]: S
# ➤ ¿Monitorear Railway? [S/n]: S

# Resultado: Deploy automático y seguro
```

### Ejemplo 2: Agregar Dependencia Nueva
```bash
# Editaste package.json para agregar "express-rate-limit"

.opencode/skills/deploy/scripts/deploy-bot.sh gui

# El bot detectará:
# ⚠️  package.json modificado detectado
# ❌ ERROR: package-lock.json NO está actualizado
# ➤ ¿Ejecutar 'npm install' para regenerar package-lock.json? [S/n]: S

# [AUTO] npm install
# [AUTO] git add package-lock.json
# ✅ package-lock.json regenerado y agregado al staging

# Continúa con el resto del flujo...
```

### Ejemplo 3: Error de TypeScript
```bash
# Tu código tiene un error de compilación

.opencode/skills/deploy/scripts/deploy-bot.sh gui

# El bot ejecutará:
# 🔨 PASO 4/7: Compilando Backend TypeScript
# ❌ ERROR: Errores de TypeScript encontrados
# 
# Errores:
# src/middleware/auth.ts(2,17): error TS2307: Cannot find module 'jsonwebtoken'
#
# ➤ ¿Intentar corregir automáticamente errores comunes? [S/n]: S
# ℹ️ Agregando moduleResolution a tsconfig.json...
# ❌ Aún hay errores. Corrígelos manualmente:
# src/middleware/auth.ts(2,17): error TS2307: Cannot find module 'jsonwebtoken'

# El deploy se detiene hasta que corrijas el error
```

### Ejemplo 4: Verificación Rápida
```bash
# Solo quieres verificar que todo está bien

.opencode/skills/deploy/scripts/deploy-bot.sh check

# Resultado:
# ✅ Todo verificado. Listo para deploy.
#    Ejecuta: .opencode/skills/deploy/scripts/deploy-bot.sh gui
```

## Reglas de Oro Integradas

1. **NUNCA** modificar `package.json` sin ejecutar `npm install`
   → Bot lo ejecuta automáticamente

2. **SIEMPRE** incluir `package-lock.json` con `package.json`
   → Bot lo agrega automáticamente

3. **SIEMPRE** verificar `tsc --noEmit` antes de push
   → Bot lo ejecuta y corrige errores comunes

4. **NUNCA** push si hay errores de build
   → Bot se detiene y muestra el error

5. **NUNCA** commitear `.env` o credenciales
   → Bot detecta y remueve automáticamente

## Troubleshooting

### El bot se detiene en Paso 4 (Compilación)
**Causa:** Errores de TypeScript que no puede corregir automáticamente
**Solución:**
```bash
# Ver el error específico
cd server && npx tsc --noEmit

# Corregir el error en tu código
# Re-ejecutar el bot
.opencode/skills/deploy/scripts/deploy-bot.sh gui
```

### El bot detecta .env pero no los remueve
**Causa:** Los archivos ya fueron commiteados previamente
**Solución:**
```bash
# Remover del historial (cuidado)
git rm --cached .env
git commit -m "fix: remover .env del repositorio"
```

### Quiero hacer push sin usar el bot
**Solución:**
```bash
# El bot es recomendado, pero puedes hacerlo manual:
git add -A
git commit -m "tu mensaje"
git push origin main

# Luego monitorea Railway manualmente
```

## Configuración Avanzada

### Cambiar el proyecto de Railway
Editar la variable en el script:
```bash
RAILWAY_PROJECT="tu-proyecto-id"
```

### Agregar más patrones de credenciales
Editar el array `CREDENTIAL_PATTERNS` en el script.

### Desactivar correcciones automáticas
Usar modo `check` primero, luego ejecutar manualmente.

## Actualización del Skill

Si agregas nuevas dependencias o cambias la estructura del proyecto:

1. Actualizar el script si es necesario
2. Agregar nuevas verificaciones al Paso 4
3. Documentar en este SKILL.md

## Referencias

- [Script Principal](./scripts/deploy-bot.sh)
- [Historial de Errores](./docs/errores-deploy.md)
- [GitHub Repository](https://github.com/Foxnet360/ComparadorPYME)
- [Railway Dashboard](https://railway.app/project/miraculous-blessing)
