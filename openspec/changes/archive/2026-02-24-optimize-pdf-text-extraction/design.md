# Context

El backend actual usa Gemini File API para procesar PDFs, tratándolos como imágenes. Esto es costoso en tokens para PDFs de texto nativo.

## Goals / Non-Goals

**Goals:**
- Reducir tokens de entrada en 60%+ al usar texto en lugar de imágenes
- Mantener la calidad de extracción de datos de pólizas
- Preservar compatibilidad con el schema JSON de salida existente

**Non-Goals:**
- Soportar PDFs escaneados (imágenes reales)
- Implementar Context Caching (fase posterior)
- Cambiar la estructura del frontend

## Decisions

### Decision 1: Usar `pdf-parse` para extracción de texto

**Razón:** Es ligero (~2MB), sin dependencias nativas, funciona bien en Cloud Run.

**Alternativas consideradas:**
- `pdf2json`: Más pesado, extrae estructura pero no la necesitamos
- `pdfjs-dist`: Full Mozilla PDF.js, overkill para texto simple
- `@google-cloud/documentai`: Costoso, es OCR para scans

### Decision 2: Enviar texto como string en el prompt, no como file

**Razón:** Elimina la necesidad de File API y el proceso de upload+wait.

**Implementación:**
```typescript
const result = await model.generateContent([
  { text: systemInstruction },
  { text: `COTIZACIÓN 1:\n${extractedText1}` },
  { text: `COTIZACIÓN 2:\n${extractedText2}` },
  { text: `CLAUSULADO:\n${clauseText}` }
]);
```

### Decision 3: Estructurar el texto extraído con marcadores

**Razón:** Ayuda al modelo a identificar secciones del documento.

**Formato:**
```
=== INICIO COTIZACIÓN: [nombre_archivo] ===
[texto extraído]
=== FIN COTIZACIÓN ===
```

## Technical Notes

- `pdf-parse` extrae texto preservando saltos de línea (crítico para tablas)
- El orden de páginas se mantiene secuencialmente
- Archivos con protección de contraseña fallarán (manejado con try-catch)
