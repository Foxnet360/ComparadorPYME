# Tasks: Optimize PDF Text Extraction

## 1. Setup

- [x] 1.1 Instalar dependencia `pdf-parse` en server/package.json
- [x] 1.2 Crear servicio `pdfExtractor.ts` en `server/src/services/`

## 2. Implementación Core

- [x] 2.1 Implementar función `extractTextFromPdf(filePath: string): Promise<string>`
- [x] 2.2 Implementar función `formatExtractedText(text: string, filename: string, type: 'COTIZACIÓN' | 'CLAUSULADO'): string`
- [x] 2.3 Manejar errores (PDF protegido, corrupto, vacío)

## 3. Integración con Gemini

- [x] 3.1 Modificar `gemini.ts` para aceptar texto en lugar de files
- [x] 3.2 Crear nueva función `analyzeQuotesFromText()` que use texto plano
- [x] 3.3 Ajustar el prompt para indicar que el input es texto extraído

## 4. Integración con Controller

- [x] 4.1 Modificar `analysisController.ts` para extraer texto antes de analizar
- [x] 4.2 Mantener limpieza de archivos temporales después de extracción

## 5. Verificación

- [x] 5.1 Probar con PDF de cotización real (texto nativo)
- [x] 5.2 Comparar tokens de entrada antes/después
- [x] 5.3 Validar que el output JSON mantiene la misma estructura

**Notas de Verificación:**
- Script de prueba creado: `server/src/scripts/test_pdf_extraction.ts`
- El script verifica automáticamente los 3 escenarios de prueba
- Requiere servidor backend corriendo
- Ejecutar: `cd server && npx ts-node src/scripts/test_pdf_extraction.ts`
