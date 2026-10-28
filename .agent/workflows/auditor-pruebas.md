---
description: Asistente para auditoría exhaustiva de pruebas, revisión funcional por módulo y generación de plan de mejoras
---

# Flujo de Auditoría de Pruebas y Plan de Mejoras

Este workflow guía la ejecución rigurosa de pruebas auditadas sobre el comparador de seguros (`comparador-csa`), evaluando estabilidad, calidad de código y diseño arquitectónico módulo a módulo para emitir un Plan de Mejoras priorizado.

**Uso**:
- `/auditor-pruebas` (auditoría completa del sistema)
- `/auditor-pruebas <modulo>` (ej: `/auditor-pruebas backend`, `/auditor-pruebas extractor`, `/auditor-pruebas frontend`)

---

## Pasos de Ejecución

### 1. Definición del Alcance y Descubrimiento
Identificar los módulos a auditar:
1. **Extracción y Pipeline LLM** (`server/src/services/*Extractor*`, `gemini`, evaluación golden)
2. **Ontología y Matching Semántico** (`server/src/services/coverage*`, `deductibleParser*`)
3. **Motor de Comparación y Exportación** (`comparisonService*`, `excelExport*`)
4. **Chat y RAG Asistente** (`chatService*`, triple fuente de verdad)
5. **Backend Core & Seguridad** (Express 5, middleware de rate limiting, validación de schemas, Supabase)
6. **Frontend & UX** (Componentes React, virtualización con TanStack, manejo de estado, carga de archivos)

---

### 2. Ejecución Automatizada de Pruebas (Verificación de Evidencia)

Ejecutar las suites pertinentes en terminal:

```bash
# Paso 2.1: Verificación de tipos estáticos
npm run typecheck:backend
npm run typecheck:frontend

# Paso 2.2: Pruebas unitarias
npm run test:unit:backend
npm run test:unit:frontend

# Paso 2.3: Pruebas de integración
npm run test:integration

# Paso 2.4: Linter y formato
npm run lint
```

*Nota*: Si alguna prueba falla o se degrada, capturar el stack trace exacto y no omitirlo.

---

### 3. Revisión Detenida por Módulo (Auditoría Técnica)

Para cada módulo dentro del alcance, auditar contra los siguientes pilares de Senior Architecture:
- **Resiliencia & Manejo de Errores**: ¿Los errores se capturan con tipos adecuados o rompen el proceso? ¿Hay fallbacks ante fallos de APIs externas (Gemini / Supabase)?
- **Aislamiento & Responsabilidad Única (SRP)**: ¿El servicio mezcla lógica de negocio con acceso a datos o llamadas HTTP directas?
- **Cobertura de Casos Borde**: ¿Qué pasa con cotizaciones malformadas, PDFs escaneados ruidosos o deducibles no estándar?
- **Performance & Consumo**: ¿Hay re-renders innecesarios en frontend o procesamiento síncrono bloqueante en backend?

---

### 4. Generación del Informe de Auditoría y Plan de Mejoras

Generar un documento estructurado `docs/audits/plan-de-mejoras-<fecha>.md` o entregarlo como reporte con:

1. **Estado de las Pruebas**: Métricas cuantitativas (Passing / Failing / Skipped / Coverage).
2. **Matriz de Diagnóstico por Módulo**:
   - Módulo | Característica | Estado | Hallazgo Técnico
3. **Plan de Mejoras Priorizado**:
   - **Fase 1 (P0 - Bloqueantes / Críticos)**: Fallos funcionales, pérdidas de datos, errores en parsing.
   - **Fase 2 (P1 - Arquitectura & Resiliencia)**: Desacoplamiento, refactorización de servicios complejos, robustez de schemas.
   - **Fase 3 (P2 - Optimización & UX/DX)**: Performance de renderizado, testing golden set, mejoras de tipado.
4. **Criterios de Aceptación y Próximos Pasos** para cada tarea del plan.
