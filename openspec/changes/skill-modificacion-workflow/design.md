## Context

El proyecto está desplegado en Railway con auto-deploy desde la rama main. El desarrollador trabaja solo pero necesita un flujo estructurado para:
1. Desarrollar nuevas funcionalidades sin romper producción
2. Tener control total de cada cambio
3. Poder probar localmente antes de deployar
4. Documentar cada modificación con OpenSpec

## Goals / Non-Goals

**Goals:**
- Crear skill interactivo "modificacion" paso a paso
- Proteger rama main contra pushes accidentales
- Establecer flujo feature-branch → main → Railway
- Documentar proceso completo

**Non-Goals:**
- No implementar CI/CD complejo con GitHub Actions
- No cambiar la arquitectura del proyecto
- No modificar funcionalidades existentes

## Decisions

### 1. Skill Interactivo vs Archivo Estático
**Decisión:** Skill interactivo que guía conversacionalmente
**Rationale:** Proporciona contexto específico del proyecto y puede adaptarse

### 2. Merge Directo vs Pull Requests
**Decisión:** Merge directo desde consola pero con verificación previa del skill
**Rationale:** El desarrollador trabaja solo, no necesita review externa

### 3. Branch Protection Simple
**Decisión:** Requerir status checks y no permitir push force
**Rationale:** Protección básica sin complicar el flujo

## Risks / Trade-offs

**Riesgo:** Skill puede ser ignorado
**Mitigación:** Integrar verificaciones obligatorias

## Migration Plan

1. Crear skill en .opencode/skills/modificacion/
2. Configurar branch protection en GitHub
3. Crear CONTRIBUTING.md
4. Probar flujo completo

## Open Questions

1. ¿Necesita el skill integración con GitHub CLI?
2. ¿Debe el skill crear automáticamente ramas?
