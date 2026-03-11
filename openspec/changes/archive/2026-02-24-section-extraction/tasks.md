# Tasks: Section Extraction

## 1. Servicio de Extracción

- [x] 1.1 Crear `server/src/services/sectionExtractor.ts`
- [x] 1.2 Definir schema JSON para respuesta de secciones
- [x] 1.3 Implementar `extractSections(textoCompleto): Promise<Secciones>`
- [x] 1.4 Manejar timeout y errores (fallback graceful)

## 2. Integración con Clause Library

- [x] 2.1 Modificar `createClause()` para llamar extracción después de guardar texto
- [x] 2.2 Añadir endpoint `POST /api/clauses/:id/extract` para re-extracción
- [x] 2.3 Actualizar tipo `ClauseDocument` con secciones pobladas

## 3. UI Opcional

- [x] 3.1 Mostrar estado de extracción en lista de clausulados
- [x] 3.2 Botón "Re-extraer secciones" en detalle de clausulado

## 4. Verificación

- [x] 4.1 Probar extracción con clausulado real
- [x] 4.2 Verificar que secciones se almacenan correctamente
- [x] 4.3 Verificar tokens usados vs documento completo

**Notas de Verificación:**
- Script de prueba creado: `server/src/scripts/test_section_extraction.ts`
- El script verifica automáticamente los 3 escenarios de prueba
- Requiere GEMINI_API_KEY configurado
- Ejecutar: `cd server && npx ts-node src/scripts/test_section_extraction.ts`
