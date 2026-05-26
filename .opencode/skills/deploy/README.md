# Deploy Seguro v2.0 - README

## 🚀 Deploy Bot - Automatización Completa

El **Deploy Bot** automatiza TODO el proceso de deploy, ejecutando verificaciones y correcciones automáticamente.

## Uso en 3 Pasos

### 1. Después de hacer cambios en tu código:
```bash
.opencode/skills/deploy/scripts/deploy-bot.sh gui
```

### 2. Responde las preguntas del bot:
- ✅ El bot verifica TODO automáticamente
- ✅ Corrige errores comunes
- ✅ Te pregunta solo cuando es necesario

### 3. ¡Listo!
El bot hace commit, push y monitorea Railway automáticamente.

## Modos Disponibles

| Modo | Comando | Uso |
|------|---------|-----|
| **Guiado** (recomendado) | `deploy-bot.sh gui` | Te pregunta en cada paso |
| Automático | `deploy-bot.sh auto` | Sin preguntas, solo si todo está perfecto |
| Verificar | `deploy-bot.sh check` | Solo verifica, no ejecuta cambios |

## Ejemplo Completo

```bash
# Editaste archivos y quieres deployar
$ .opencode/skills/deploy/scripts/deploy-bot.sh gui

🚀 DEPLOY BOT v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 1/7: Verificando Estado del Repositorio
✅ Estamos en la rama main
✅ Hay cambios pendientes para commitear

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 2/7: Sincronizando con Remoto
✅ Repositorio sincronizado

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 3/7: Verificando Dependencias
✅ Dependencias sincronizadas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 4/7: Compilando Backend TypeScript
✅ Backend compila sin errores ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 5/7: Verificando Seguridad
✅ Verificación de seguridad completada

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 6/7: Commit y Push
Resumen de cambios:
 server/src/routes/chat.ts | 15 ++++++++++++

➤ ¿Agregar todos los archivos al staging? [S/n]: S
✅ Todos los archivos agregados

Mensaje de commit: fix: corregir validación en chat
➤ ¿Confirmar commit y push? [S/n]: S
✅ Commit creado exitosamente
✅ Push exitoso! 🎉

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 7/7: Monitoreando Railway
⏳ Esperando 30 segundos para verificar build...

═══════════════════════════════════════════════════════════════
✅ Deploy completado exitosamente!

Próximos pasos:
  1. Verifica Railway dashboard
  2. Espera 2-3 minutos para que el deploy termine
  3. Prueba la aplicación en producción
```

## ¿Qué hace el bot automáticamente?

✅ Verifica que estés en `main`
✅ Sincroniza con el remoto
✅ Ejecuta `npm install` si cambiaste dependencias
✅ Agrega `package-lock.json` al staging
✅ Compila TypeScript y corrige errores comunes
✅ Detecta y remueve archivos `.env`
✅ Busca credenciales hardcodeadas
✅ Hace commit y push
✅ Monitorea Railway

## Si algo falla...

El bot **se detiene** y te dice exactamente qué corregir:

```
❌ ERROR: package-lock.json NO está actualizado
   Ejecuta: npm install && git add package-lock.json
```

Corriges, y ejecutas el bot de nuevo.

## Documentación Completa

Ver [SKILL.md](./SKILL.md) para documentación detallada.

## Reglas de Oro

1. **NUNCA** modificar `package.json` sin ejecutar `npm install`
2. **SIEMPRE** incluir `package-lock.json` con `package.json`
3. **SIEMPRE** verificar `tsc --noEmit` antes de push
4. **NUNCA** push si hay errores de build
5. **NUNCA** commitear `.env` o credenciales
