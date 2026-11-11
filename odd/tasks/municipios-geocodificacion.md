# Feature: Catálogo Completo de Departamentos/Municipios de Colombia y Geocodificación Automática

## Specs
- **S1**: Integrar la totalidad de los 32 departamentos (+ Bogotá D.C.) y los 1,122 municipios oficiales de Colombia (DANE DIVIPOLA) con coordenadas oficiales y zona sísmica NSR-10.
- **S2**: Proveer una UX fluida y sin sobrecarga en la creación/edición de clientes: selector de departamento y combobox/searchable input de municipios con filtrado instantáneo y autoselección inversa de departamento.
- **S3**: Asignar automáticamente coordenadas iniciales del municipio al seleccionarlo, y geocodificar automáticamente según la dirección completa (`address, city, department`) con fallback transparente al municipio.
- **S4**: Mantener campos de latitud y longitud editables y proveer feedback visual del origen de las coordenadas (dirección vs municipio) y estado de geocodificación.

## Tasks
- [x] T1 (S1): Generar catálogo nacional completo de 1,122 municipios en `src/data/colombiaGeo.ts`. | inline | completed
- [x] T2 (S3): Implementar `src/services/geocodingService.ts` con geocodificación automática, debounce y fallback al municipio. | inline | completed
- [x] T3 (S2, S4): Actualizar `components/ClientManager.tsx` con el selector searchable y georreferenciación automática. | inline | completed
- [x] T4 (S1-S4): Crear pruebas unitarias y de integración para geocoding, catálogo y componente. | inline | completed

## Log
- L1: Petición original del usuario para listado completo de departamentos y municipios sin sobrecargar la UX, y coordenadas GPS automáticas según dirección y municipio.
