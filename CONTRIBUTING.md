# Guía de Contribución - Comparador PYME

## Flujo de Trabajo

Este proyecto usa un flujo de trabajo simple pero robusto para mantener la rama `main` estable y desplegada en Railway.

## Diagrama del Flujo

```
feature/* ──▶ main ──▶ Railway (Producción)
   │            │
   │            └── Auto-deploy
   │
   └── Desarrollo seguro
```

## Paso a Paso

### 1. Preparar Entorno

```bash
# Asegurarse de estar en main actualizado
git checkout main
git pull origin main
```

### 2. Crear Rama Feature

```bash
# Crear rama con nombre descriptivo
git checkout -b feature/descripcion-corta

# Ejemplos:
git checkout -b feature/agregar-login
git checkout -b feature/mejorar-ui-dashboard
git checkout -b fix/corregir-calculo-primas
```

### 3. Planificar con OpenSpec (Recomendado)

Para cambios significativos, documenta el plan:

```bash
# Crear change
openspec new change "nombre-del-cambio"

# Completar artifacts
# - proposal.md: ¿Por qué?
# - design.md: ¿Cómo?
# - specs/**/*.md: ¿Qué?
# - tasks.md: Tareas
```

### 4. Desarrollar

```bash
# Hacer cambios...
# Editar archivos...

# Verificar cambios
git status

# Agregar y commitear
git add .
git commit -m "feat: descripción del cambio"

# Push a rama feature (no deploya)
git push origin feature/descripcion-corta
```

### 5. Verificar Localmente

**OBLIGATORIO antes de mergear:**

```bash
# Build completo
npm run build

# Verificar que compila frontend
ls dist/

# Verificar que compila backend
ls server/dist/

# Iniciar servidor local
npm start

# Probar en navegador
# http://localhost:8080
# http://localhost:8080/health
```

### 6. Integrar a Main

```bash
# Volver a main
git checkout main
git pull origin main

# Mergear feature
git merge feature/descripcion-corta

# Push a main
# ⚠️ Esto desencadena deploy en Railway
git push origin main
```

### 7. Validar en Producción

```bash
# Esperar 2-3 minutos a que Railway deploye
# Verificar Railway Dashboard → Logs
# Probar funcionalidad en producción
```

## Reglas Importantes

- ✅ **SIEMPRE** usar ramas `feature/*` para desarrollar
- ✅ **SIEMPRE** probar localmente antes de mergear
- ✅ **SIEMPRE** documentar cambios significativos con OpenSpec
- ❌ **NUNCA** push directo a `main`
- ❌ **NUNCA** mergear sin verificar build local
- ❌ **NUNCA** commitear `.env` o secrets

## Convenciones de Commits

Usar prefijos descriptivos:

- `feat:` Nueva funcionalidad
- `fix:` Corrección de bug
- `refactor:` Cambio de código sin cambiar funcionalidad
- `docs:` Documentación
- `test:` Tests
- `chore:` Tareas de mantenimiento

Ejemplos:
```
feat: agregar exportación a PDF
fix: corregir cálculo de deducibles
refactor: optimizar extracción de texto
docs: actualizar README con nuevas instrucciones
```

## Estructura de Ramas

```
main                    ← Producción (Railway)
├── feature/login       ← Desarrollo login
├── feature/pdf-export  ← Desarrollo export PDF
├── fix/cors-error      ← Corrección CORS
└── hotfix/urgente      ← Corrección urgente
```

## Configuración de Branch Protection

La rama `main` está protegida en GitHub:

1. No se permite push directo
2. No se permite force push
3. No se permite borrar la rama
4. Se requiere que el build pase antes de mergear (si hay CI)

### Para configurar (solo una vez):

1. Ir a GitHub → Repositorio → Settings → Branches
2. Agregar rule para `main`
3. Habilitar:
   - [x] Restrict pushes that create files larger than 100MB
   - [x] Require a pull request before merging (opcional)
   - [x] Require status checks to pass before merging (si hay CI)
   - [x] Require branches to be up to date before merging
   - [x] Do not allow bypassing the above settings

## Troubleshooting

### "Cannot push to main"
**Solución:** Usar ramas `feature/*`

### "Build fails after merge"
**Solución:**
```bash
rm package-lock.json
npm install
git add package-lock.json
git commit -m "fix: regenerar package-lock"
```

### "Railway no deploya"
**Verificar:**
1. Railway Dashboard → Deployments
2. Verificar que el build fue exitoso
3. Verificar logs de errores

## Recursos

- [README.md](README.md) - Información general
- [DEPLOY.md](DEPLOY.md) - Guía de despliegue
- [Skill: Modificación](.opencode/skills/modificacion/SKILL.md) - Skill interactivo

## Contacto

Para problemas o sugerencias, crear un issue en GitHub.
