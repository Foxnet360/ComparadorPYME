## Why

El proyecto Comparador PYME necesita un sistema robusto de control de cambios para evitar que modificaciones en desarrollo afecten la rama main que está en producción en Railway. Actualmente, cualquier push a main desencadena un deploy automático, lo cual es riesgoso cuando se están desarrollando nuevas funcionalidades o correcciones.

## What Changes

- Crear skill interactivo "modificacion" que guíe al desarrollador paso a paso
- Configurar branch protection en GitHub para la rama main
- Establecer flujo de trabajo con ramas feature/*
- Documentar el proceso completo en CONTRIBUTING.md
- Configurar Railway para deployar solo desde main

## Capabilities

### New Capabilities
- `skill-modificacion`: Skill interactivo que acompaña el proceso completo de modificación
- `branch-protection`: Protección de la rama main en GitHub
- `feature-workflow`: Flujo de trabajo con ramas feature/*

### Modified Capabilities

## Impact

**Archivos afectados:**
- `.github/settings.yml` o configuración de branch protection
- `CONTRIBUTING.md` (nuevo)
- `.opencode/skills/modificacion/SKILL.md` (nuevo)
- Documentación del proyecto

**APIs:** Sin cambios

**Dependencies:** Sin cambios

**Sistemas externos:**
- GitHub: Branch protection rules
- Railway: Configuración de deploy
