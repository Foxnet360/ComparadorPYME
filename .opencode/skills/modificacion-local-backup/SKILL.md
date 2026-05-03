# Skill: modificacion

## Descripción

Skill interactivo para gestionar modificaciones al proyecto Comparador PYME de forma segura, sin afectar la rama main que está en producción en Railway.

## Flujo de Trabajo

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO DE MODIFICACIÓN                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. INICIAR                                                 │
│     └─▶ ¿Qué quieres modificar?                             │
│     └─▶ Crear rama: feature/nombre-descriptivo              │
│                                                             │
│  2. PLANIFICAR (OpenSpec)                                   │
│     └─▶ /opsx-new nombre-del-cambio                         │
│     └─▶ Crear proposal, design, specs, tasks                │
│                                                             │
│  3. DESARROLLAR                                             │
│     └─▶ Trabajar en rama feature/*                          │
│     └─▶ Commits frecuentes                                  │
│     └─▶ Probar localmente                                   │
│                                                             │
│  4. VERIFICAR                                               │
│     └─▶ npm run build (frontend + backend)                  │
│     └─▶ Probar funcionalidades                              │
│     └─▶ Revisar logs de errores                             │
│                                                             │
│  5. INTEGRAR                                                │
│     └─▶ git checkout main                                   │
│     └─▶ git pull origin main                                │
│     └─▶ git merge feature/nombre                            │
│     └─▶ git push origin main                                │
│                                                             │
│  6. VALIDAR                                                 │
│     └─▶ Railway deploya automáticamente                     │
│     └─▶ Verificar en producción                             │
│     └─▶ Archivar change: /opsx-archive                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Comandos Git

### Iniciar modificación
```bash
# Asegurarse de estar en main y actualizado
git checkout main
git pull origin main

# Crear rama feature
git checkout -b feature/nombre-descriptivo

# Ejemplo:
git checkout -b feature/agregar-export-pdf
```

### Durante desarrollo
```bash
# Ver cambios
git status

# Agregar archivos
git add .

# Commit descriptivo
git commit -m "feat: agregar exportación a PDF"

# Push a rama feature (no deploya)
git push origin feature/nombre-descriptivo
```

### Integrar a main
```bash
# Volver a main
git checkout main

# Actualizar main
git pull origin main

# Mergear feature
git merge feature/nombre-descriptivo

# Push a main (Railway deploya automáticamente)
git push origin main
```

## Verificaciones Obligatorias

Antes de mergear a main, verificar:

- [ ] `npm run build` funciona sin errores
- [ ] Frontend compila (dist/ se genera)
- [ ] Backend compila (server/dist/ se genera)
- [ ] Aplicación inicia localmente (`npm start` o `node index.js`)
- [ ] Health check responde (`http://localhost:8080/health`)
- [ ] Funcionalidad modificada funciona correctamente
- [ ] No hay errores en consola del navegador
- [ ] Variables de entorno están configuradas

## Estructura del Proyecto

```
comparador-csa/
├── .opencode/
│   └── skills/
│       └── modificacion/
│           └── SKILL.md          ← Este archivo
├── openspec/
│   └── changes/                   ← Changes activos
├── server/
│   ├── src/                       ← Código fuente backend
│   │   ├── controllers/
│   │   ├── services/
│   │   └── index.ts
│   └── dist/                      ← Build backend (no en git)
├── components/                    ← Componentes React
├── services/                      ← Servicios frontend
├── dist/                          ← Build frontend (no en git)
├── Dockerfile                     ← Config Railway
├── railway.json                   ← Config Railway
├── package.json                   ← Dependencias unificadas
└── index.js                       ← Entry point
```

## Reglas Importantes

1. **NUNCA** hacer push directo a main desde desarrollo
2. **SIEMPRE** usar ramas feature/* para desarrollar
3. **SIEMPRE** probar localmente antes de mergear
4. **SIEMPRE** usar OpenSpec para documentar cambios significativos
5. **NUNCA** commitear archivos .env o secrets
6. **SIEMPRE** mantener dist/ y server/dist/ en .gitignore

## Integración con OpenSpec

### Para cambios significativos:
```bash
# Crear change
/opsx-new nombre-del-cambio

# Seguir el flujo:
# 1. proposal.md - ¿Por qué?
# 2. design.md - ¿Cómo?
# 3. specs/**/*.md - ¿Qué?
# 4. tasks.md - Tareas

# Implementar cambios
# ... desarrollo ...

# Archivar cuando esté completo
/opsx-archive nombre-del-cambio
```

### Para cambios menores (hotfix):
```bash
# No es necesario OpenSpec
# Solo crear rama hotfix/ y mergear
```

## Troubleshooting

### Error: "Cannot push to main"
**Causa:** Branch protection activo
**Solución:** Usar ramas feature/*

### Error: "Build fails in Railway"
**Causa:** package-lock.json desincronizado
**Solución:** `rm package-lock.json && npm install && git add package-lock.json`

### Error: "Variables de entorno no cargan"
**Causa:** Falta configurar en Railway Dashboard
**Solución:** Railway Dashboard → Variables → Agregar variables

### Error: "Gemini 403 Forbidden"
**Causa:** Problema de facturación en Google Cloud
**Solución:** Verificar facturación en Google Cloud Console

## Consejos

- Commits pequeños y frecuentes
- Mensajes descriptivos: `feat:`, `fix:`, `refactor:`, `docs:`
- Probar en local antes de cada push a main
- Mantener main siempre estable
- Usar `git log --oneline` para ver historial

## Contacto y Ayuda

Si tienes problemas:
1. Revisar logs de Railway Dashboard
2. Verificar `docker build -t test .` localmente
3. Consultar README.md y DEPLOY.md
4. Revisar issues en GitHub
