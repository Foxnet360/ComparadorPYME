# Context

El sistema actual no tiene persistencia de clausulados. Cada análisis requiere re-subir y re-procesar los mismos documentos.

## Goals / Non-Goals

**Goals:**
- Almacenar clausulados una vez, reutilizar infinitamente
- Búsqueda rápida por aseguradora/producto
- Detectar cambios automáticamente via hash

**Non-Goals:**
- Versionado completo (solo última versión activa)
- OCR para clausulados escaneados

## Decisions

### Decision 1: Estructura de documento en Firestore

```typescript
interface ClauseDocument {
  id: string;                    // Auto-generado
  aseguradora: string;           // "Bolívar", "Allianz", etc.
  producto: string;              // "Todo Riesgo Daños Materiales"
  version: string;               // "2024"
  hash: string;                  // SHA256 del texto
  textoCompleto: string;         // Texto extraído del PDF
  secciones: {                   // Poblado por section-extraction
    exclusiones?: string;
    deducibles?: string;
    garantias?: string;
  };
  tokensEstimados: number;       // Para estimación de costos
  fechaCreacion: Date;
  fechaActualizacion: Date;
  activo: boolean;
}
```

### Decision 2: Colección única con índices compuestos

Usar colección `clausulados` con índices en:
- `aseguradora` (para filtros)
- `aseguradora + producto` (para búsqueda específica)
- `hash` (para detección de duplicados)

### Decision 3: UI simple de administración

Tab adicional en la app para gestión de clausulados, solo visible para rol admin.
