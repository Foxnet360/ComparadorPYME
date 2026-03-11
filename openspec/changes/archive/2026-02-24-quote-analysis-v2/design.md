# Context

El análisis actual requiere subir clausulados cada vez. Con la biblioteca de clausulados, podemos simplificar el flujo y reducir tokens.

## Goals / Non-Goals

**Goals:**
- UX simplificada: seleccionar en lugar de subir
- Reducción de tokens usando solo secciones relevantes
- Mantener compatibilidad con flujo actual (backwards compatible)

**Non-Goals:**
- Eliminar capacidad de subir clausulados manualmente
- Cambiar estructura de respuesta del análisis

## Decisions

### Decision 1: UI híbrida de clausulados

```
┌─────────────────────────────────────────────────────┐
│ CLAUSULADOS                                          │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ○ Seleccionar de biblioteca     ○ Subir archivos   │
│                                                      │
│ [Si biblioteca seleccionada:]                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │ □ Bolívar - Todo Riesgo 2024                    │ │
│ │ □ Allianz - Incendio 2024                       │ │
│ │ □ Chubb - RC General 2024                       │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ [Si subir seleccionado:]                            │
│ [Drop zone para PDFs]                               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Decision 2: Endpoint de análisis acepta ambos

El endpoint `/api/analyze` aceptará:
- `clauseFiles`: PDFs subidos (flujo actual)
- `clauseIds`: Array de IDs de biblioteca (flujo nuevo)

Si `clauseIds` está presente, se ignoran `clauseFiles`.

### Decision 3: Construcción de prompt optimizado

Para clausulados de biblioteca, construir prompt con secciones:

```
--- CLAUSULADOS DE REFERENCIA ---

=== Bolívar - Todo Riesgo 2024 ===
EXCLUSIONES:
[texto sección exclusiones]

DEDUCIBLES:
[texto sección deducibles]

GARANTÍAS:
[texto sección garantías]
===
```
