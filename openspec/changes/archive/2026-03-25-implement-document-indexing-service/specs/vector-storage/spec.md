# Spec: Vector Storage

## Capability
Almacenar chunks con embeddings en Supabase, gestionar imágenes de páginas en Storage, y mantener relaciones entre documentos, chunks e imágenes.

## User Story
**Como** sistema de indexación  
**Quiero** persistir chunks vectoriales y sus imágenes  
**Para** poder recuperarlos en búsquedas semánticas

## Functional Requirements

### FR-1: Almacenamiento de documentos
Tabla `documents`:
- Crear registro con metadata
- Asociar a aseguradora (insurer_id)
- Guardar path en storage
- Crear/actualizar aseguradora si no existe

### FR-2: Almacenamiento de chunks
Tabla `chunks`:
- Guardar contenido y contenido normalizado
- Guardar embedding vector(768)
- Guardar coverage_tags (array)
- Guardar section_type
- Relacionar con document_id

### FR-3: Almacenamiento de imágenes
Tabla `page_images` + Storage:
- Subir PNG a bucket `clause-pages`
- Guardar storage_url y storage_path
- Relacionar con document_id y page_number
- Almacenar dimensiones (width, height)

### FR-4: Gestión de transacciones
- Rollback en caso de error
- Eliminar datos parciales si falla
- Cleanup de archivos temporales

## Database Operations

### Insert Document
```sql
INSERT INTO documents (
  insurer_id, document_name, document_type,
  version, total_pages, storage_path, is_active
) VALUES (...)
```

### Insert Chunks
```sql
INSERT INTO chunks (
  document_id, page_number, content,
  content_normalized, embedding, coverage_tags, section_type
) VALUES (...)
```

### Insert Page Images
```sql
INSERT INTO page_images (
  document_id, page_number, storage_url,
  storage_path, width, height
) VALUES (...)
```

## Error Handling
- Transacción fallida → Rollback manual
- Error de Storage → Limpiar archivos subidos
- Constraint violation → Retornar error claro

## Dependencies
- **supabase**: Cliente de base de datos
- **pdfRenderer**: Para subir imágenes

## Acceptance Criteria
- [ ] Guarda documento con metadata completa
- [ ] Guarda chunks con embeddings
- [ ] Sube imágenes a Storage
- [ ] Mantiene integridad referencial
- [ ] Rollback funciona correctamente
