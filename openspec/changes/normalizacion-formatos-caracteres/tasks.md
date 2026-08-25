# Tasks: Normalización de Formatos Numéricos y Sanitización UTF-8

## Phase 1: Robustecimiento del Parser de Moneda y Números
- [ ] 1.1 Reescribir `server/src/utils/currencyParser.ts` para soportar notación dual (Coma = miles US vs Punto = miles LatAm).
- [ ] 1.2 Actualizar las pruebas unitarias en `server/src/utils/__tests__/currencyParser.test.ts` con escenarios de notación internacional ($15,000,000.00).

## Phase 2: Sanitizador de Caracteres Especiales (Mojibake UTF-8)
- [ ] 2.1 Crear `server/src/utils/textSanitizer.ts` para corregir secuencias de bytes desalineadas en tildes, ñ y símbolos náuticos/técnicos.
- [ ] 2.2 Integrar `textSanitizer` en `analysisController.ts` y transformers para limpiar automáticamente todas las respuestas JSON emitidas.

## Phase 3: Verificación & Despliegue
- [ ] 3.1 Ejecutar pruebas con `npm test`.
- [ ] 3.2 Compilar con `npm run build` y desplegar a Railway.
