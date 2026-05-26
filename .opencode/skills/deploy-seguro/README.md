# Deploy Seguro - Guía Rápida

## Uso

### Antes de cada push:
```bash
.opencode/skills/deploy-seguro/scripts/pre-push-check.sh
```

### Si todo está verificado:
```bash
git push origin main
```

## Verificaciones Automáticas

El script valida:
1. ✅ Estado del repositorio (rama main, cambios pendientes)
2. ✅ Sincronización con remoto
3. ✅ Dependencias (package.json ↔ package-lock.json)
4. ✅ Compilación TypeScript sin errores
5. ✅ Archivos sensibles (.env no commiteados)
6. ✅ Mensaje de commit descriptivo

## Reglas de Oro

1. **NUNCA** modificar `package.json` sin ejecutar `npm install`
2. **SIEMPRE** incluir `package-lock.json` con `package.json`
3. **SIEMPRE** verificar `tsc --noEmit` antes de push
4. **NUNCA** push si hay errores de build
5. **NUNCA** commitear `.env` o credenciales

## Troubleshooting

### Si el script detecta errores:
1. Lee el mensaje de error
2. Ejecuta la corrección sugerida
3. Vuelve a ejecutar el script
4. Repite hasta que pase

### Si necesitas bypass (EMERGENCIA):
```bash
git push origin main --no-verify
```
⚠️ Solo usar si entiendes el riesgo

## Documentación Completa

Ver [SKILL.md](./SKILL.md) para el flujo completo y estrategia de deploy.
