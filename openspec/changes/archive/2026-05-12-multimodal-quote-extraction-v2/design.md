## Context

The current quote extraction pipeline (`pdfjs-dist` → texto plano → Gemini 2.5 Flash → JSON rígido) está fallando en producción. Los logs muestran:

1. **Valores inventados**: El schema forzado de 14 coberturas obliga a Gemini a devolver `0 COP` o `NO ESPECIFICADO` para coberturas que no existen en el PDF
2. **Detección incorrecta**: SBS fue detectado como BBVA, inyectando el template incorrecto al prompt
3. **Destrucción de tablas**: `pdfjs-dist` convierte tablas en texto corrido, perdiendo relaciones espaciales entre coberturas, valores y deducibles
4. **Tiempo excesivo**: 2.4 minutos por análisis (146,429ms para 2 cotizaciones), principalmente por 66 intentos RAG síncronos fallidos
5. **Deducibles no reconocidos**: "Sin deducible" no es reconocido por el validador
6. **Sub-límites como coberturas**: CHUBB tiene 15+ sub-límites que se mezclan con coberturas principales
7. **Primas por cobertura ignoradas**: SBS muestra primas individuales por cobertura que no se capturan

## Goals / Non-Goals

**Goals:**
- Extraer datos de cotizaciones preservando estructura tabular mediante visión multimodal de PDFs
- Detectar automáticamente el formato del documento (6 familias) para seleccionar prompt especializado
- Capturar desglose completo de primas (neta, gastos, IVA, otros, total)
- Extraer primas por cobertura cuando estén disponibles
- Mapear coberturas crudas a 14 canónicas con confianza y método de matching
- Reducir tiempo de procesamiento a < 5 minutos total
- Separar sub-límites de coberturas principales

**Non-Goals:**
- No se procesarán PDFs escaneados (sin texto nativo) - requieren OCR
- No se modifica la interfaz de usuario existente (cambios solo en backend)
- No se implementa aprendizaje automático de formatos nuevos (requiere intervención manual)
- No se modifica el sistema de scoring existente (usa datos normalizados)
- No se elimina el parser determinístico (se mantiene como fallback de emergencia)

## Decisions

### 1. Usar Gemini 2.5 Pro con File API (no texto extraído)
**Rationale**: Gemini 2.5 Pro tiene capacidad de visión de documentos nativa. Al subir el PDF directamente, el modelo "ve" las tablas como tablas, no como texto corrido.

**Alternativas consideradas**:
- **pdf2image + OCR (Tesseract)**: Más lento, requiere dependencia adicional, calidad inferior para tablas
- **Tabula-py**: Solo extrae tablas, no maneja texto descriptivo ni secciones
- **Mantener pdfjs-dist + mejorar prompts**: Ya probado, los logs confirman que no funciona para tablas complejas

**Implementación**:
```typescript
// Subir PDF
const uploadResult = await fileManager.uploadFile(pdfPath, {
  mimeType: "application/pdf",
  displayName: filename,
});

// Esperar procesamiento
await waitForFilesActive([uploadResult.file]);

// Generar con PDF como input multimodal
const result = await model.generateContent([
  { text: specializedPrompt },
  { fileData: { fileUri: uploadResult.file.uri, mimeType: "application/pdf" } }
]);
```

### 2. Schema JSON Flexible V2 (no 14 coberturas forzadas)
**Rationale**: Los PDFs reales no tienen 14 coberturas canónicas. Forzar el schema produce valores inventados. El nuevo schema captura lo que el PDF realmente tiene.

**Estructura clave**:
```typescript
interface ExtractedQuote {
  insurerName: string;
  policyName: string;
  premium: {
    netPremium: number;
    fees: number;
    taxes: number;
    otherCharges: number;
    totalPayable: number;
    currency: string;
    periodicity: string;
  };
  insuredAssets: Array<{ assetType: string; value: number; notes?: string }>;
  rawCoverages: Array<{
    section?: string;
    rawName: string;
    insuredAmount?: number;
    deductible?: string;
    premium?: number;
    notes?: string;
  }>;
  subLimits: Array<{
    parentCoverage: string;
    name: string;
    limit: number;
    deductible?: string;
  }>;
  generalDeductibles: Array<{
    appliesTo: string;
    deductibleText: string;
  }>;
  specialConditions: string[];
  exclusions: string[];
  warranties: string[];
}
```

### 3. Detección de Familia de Formato (no per-aseguradora)
**Rationale**: Hay más aseguradoras que perfiles. Detectar por estructura de documento es más escalable y preciso que detectar por nombre de aseguradora.

**Familias detectadas**:
| Familia | Patrón | Aseguradoras |
|---------|--------|-------------|
| TABLE-DOUBLE | "DEDUCIBLES QUE APLICAN" + "AMPAROS BASICOS" | HDI |
| TABLE-INTEGRATED | "Suma Asegurada" + "Deducible" + /sub[líi]mite/ | CHUBB |
| SECTIONS | /SECCION\s+(PRIMERA｜SEGUNDA｜TERCERA)/ | MAPFRE |
| DESCRIPTIVE | "Este amparo cubre" ｜ "Se cubren los daños" | AXA |
| PRICE-TABLE | "Resumen de coberturas y primas" | SBS |
| TEXT | Ningún patrón específico | BOLÍVAR |

**Implementación**:
```typescript
function detectFormatFamily(text: string): FormatFamily {
  if (text.includes('DEDUCIBLES QUE APLICAN') && text.includes('AMPAROS BASICOS'))
    return 'TABLE-DOUBLE';
  if (text.match(/SECCION\s+(PRIMERA|SEGUNDA|TERCERA)/i))
    return 'SECTIONS';
  // ... etc
}
```

### 4. Prompts Especializados por Familia
**Rationale**: Cada familia tiene reglas específicas. Un prompt genérico falla al interpretar estructuras particulares.

**Ejemplo para TABLE-DOUBLE (HDI)**:
```
Este PDF tiene el formato "Tabla Doble":
- Página 1: Tabla "AMPAROS Y COBERTURAS" con Descripción y Suma Asegurada
- Página 2: Tabla separada "DEDUCIBLES QUE APLICAN" por tipo de amparo
- IMPORTANTE: Los deducibles NO están en la tabla de coberturas, están en la página 2
- Relaciona deducibles generales con coberturas por el nombre de la sección
```

### 5. Post-Normalización en 4 Capas
**Rationale**: Separar extracción de normalización permite:
- Extracción fiel al documento (sin forzar estructura)
- Normalización controlada con confianza
- Detección de coberturas implícitas

**Pipeline**:
```
rawCoverages → [Thesaurus Exacto] → [Fuzzy 80%] → [Embedding 0.85] → [LLM 70%] → canonicalCoverage
```

**Coberturas implícitas**:
- "AMPARO BÁSICO TODO RIESGO" → Incendio, Terremoto, HMACC implícitos
- "SECCION PRIMERA - AMPARO BASICO" → Incendio, Explosión, etc. implícitos

### 6. RAG Asíncrono
**Rationale**: Los logs muestran 66 intentos RAG fallidos que toman 30-40 segundos. Hacer RAG síncrono bloquea todo el pipeline.

**Solución**: RAG se ejecuta en paralelo con el análisis principal y sus resultados se agregan al final si llegan a tiempo.

### 7. Mantener Parser Determinístico como Fallback
**Rationale**: Si Gemini File API falla (rate limits, outage), necesitamos fallback funcional.

**Implementación**: Try/catch alrededor de multimodal extraction. Si falla, usar texto extraído + prompt de texto libre + parser determinístico.

## Risks / Trade-offs

**[Riesgo] Gemini 2.5 Pro puede ser más lento que Flash**
→ Mitigación: Procesamiento de PDFs es más preciso, reduciendo reintentos. Target de < 5 minutos es conservador.

**[Riesgo] Costo de File API con PDFs grandes**
→ Mitigación: Límite de 20MB. Los PDFs de cotizaciones típicamente son < 2MB.

**[Riesgo] Canvas warning en pdfjs-dist**
→ Mitigación: Instalar `canvas` como optional dependency en Docker. No afecta extracción de texto.

**[Riesgo] Coberturas implícitas pueden ser incorrectas**
→ Mitigación: Marcar con confidence 50% y flag `needsReview`. Analista puede verificar.

**[Riesgo] Formatos nuevos no detectados**
→ Mitigación: Fallback a formato TEXT con prompt genérico. Logs permiten identificar nuevos formatos.

**[Riesgo] "Sin deducible" no reconocido**
→ Mitigación: Ampliar `normalizeDeductible()` para reconocer "Sin deducible" como válido.

## Migration Plan

1. **Fase 1**: Implementar servicios nuevos (formatDetector, coverageNormalizer, promptBuilder)
2. **Fase 2**: Implementar extracción multimodal en gemini.ts con schema V2
3. **Fase 3**: Actualizar analysisController con nuevo pipeline
4. **Fase 4**: Testing con 11 PDFs de ejemplo
5. **Fase 5**: Deploy a producción con feature flag
6. **Fase 6**: Monitorear logs y ajustar prompts

**Rollback**: Cambiar feature flag para usar extracción anterior. No hay cambios de base de datos.

## Open Questions

1. ¿Es `gemini-2.5-pro` disponible en la API key actual? (Los logs confirman que sí)
2. ¿Cuál es el SLA de tiempo aceptable? (Confirmado: 5 minutos)
3. ¿Necesitamos guardar los PDFs subidos a Gemini? (Confirmado: no)
4. ¿Cómo manejamos primas por cobertura cuando no están disponibles? (Comparar solo prima total)
5. ¿El RAG es obligatorio para todas las funcionalidades? (Sí, pero asíncrono)
