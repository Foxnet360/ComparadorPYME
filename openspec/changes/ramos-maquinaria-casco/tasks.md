# Tasks: Ramos Maquinaria y Equipo + Casco Embarcación

## Phase 1: Tipado e Infraestructura Backend
- [ ] 1.1 Extender `INSURANCE_DOMAINS` en `server/src/types/domain.ts` con `equipo_maquinaria` y `casco_embarcacion`.
- [ ] 1.2 Actualizar `domainTaxonomyRegistry.ts` para resolver los 2 nuevos ramos.

## Phase 2: Artefactos de Dominio (Taxonomías, Tesauros, Ontologías)
- [ ] 2.1 Crear carpeta `data/domains/equipo_maquinaria/` con `taxonomy.json`, `thesaurus.json`, `ontology.json`, `template-seeds.json`, `bundle.json`.
- [ ] 2.2 Crear carpeta `data/domains/casco_embarcacion/` con `taxonomy.json`, `thesaurus.json`, `ontology.json`, `template-seeds.json`, `bundle.json`.

## Phase 3: Integración en Frontend (UI / UX)
- [ ] 3.1 Actualizar `DomainSelector.tsx` con los 10 ramos y sus íconos representativos.
- [ ] 3.2 Extender `ClientSelector.tsx` con los formularios específicos para *Maquinaria y Equipo* y *Casco Embarcación*.

## Phase 4: Verificación & Despliegue
- [ ] 4.1 Ejecutar suite de pruebas con `npm test`.
- [ ] 4.2 Compilar con `npm run build` y desplegar a Railway.
