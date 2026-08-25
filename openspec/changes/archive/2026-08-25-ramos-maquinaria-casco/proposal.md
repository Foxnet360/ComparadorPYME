# Proposal: Incorporación de 2 Nuevos Ramos: "Maquinaria y Equipo" y "Casco Embarcación"

## Intent
Integrar de manera completa y transversal 2 nuevos ramos de seguro con toda su lógica de negocio, marco regulatorio colombiano, tesauros semánticos, taxonomías, semillas de plantillas, formularios adaptativos de cliente y presencia en el selector de ramos de la plataforma:

1. **`equipo_maquinaria` ("Maquinaria y Equipo / Rotura de Maquinaria")**
2. **`casco_embarcacion` ("Casco y Marítimo / Embarcaciones")**

## Scope

### 1. Definición de Tipos & Registro (`server/src/types/domain.ts` & `domainTaxonomyRegistry.ts`)
- Extender la lista de `INSURANCE_DOMAINS` e `InsuranceDomain` para incluir `equipo_maquinaria` y `casco_embarcacion`.
- Actualizar `isInsuranceDomain()` y `resolveInsuranceDomain()` para soportar ambos dominios.

### 2. Estructura de Datos de Negocio (`data/domains/equipo_maquinaria/` y `data/domains/casco_embarcacion/`)
Crear los 5 artefactos estándar por cada uno de los 2 nuevos ramos:
- `taxonomy.json`: Categorías de cobertura con IDs, nombres canónicos, secciones y marco regulatorio (Arts. 1083-1112 C.Co para maquinaria; Arts. 1703-1772 C.Co y normas DIMAR para marítimo).
- `thesaurus.json`: Sinónimos, variantes de redacción, términos excluidos y mapa de canonización.
- `ontology.json`: Exclusiones semánticas y jerarquías entre amparos.
- `template-seeds.json`: Patrones de extracción para aseguradoras comunes (Sura, Bolivar, Mapfre, Allianz, Liberty, AXA, Seguros del Estado).
- `bundle.json`: Configuración y pesos de scoring para el comparador.

### 3. Componente Selector de Ramos (`components/DomainSelector.tsx`)
- Actualizar la lista `DOMAIN_OPTIONS` ampliando a **10 ramos**.
- Incluir las tarjetas distintivas para *Maquinaria y Equipo* y *Casco Embarcación* con íconos representativos (`HardHat` / `Cog`, `Ship` / `Anchor`).

### 4. Formulario de Datos de Cliente por Ramo (`components/ClientSelector.tsx`)
- **`equipo_maquinaria`:** Solicitar *Valor de reposición a nuevo ($ COP)*, *Marca/Modelo/Año de maquinaria*, *Uso (Construcción/Agrícola/Industrial)* y *Plan de mantenimiento preventivo*.
- **`casco_embarcacion`:** Solicitar *Matrícula y Registro DIMAR*, *Tipo de embarcación (Pesquera/Carga/Recreo/Tug)*, *Eslora / Manga / Puntal*, *Tonelaje TRB* y *Material del casco (Acero/Fibra/Madera)*.

## Success Criteria
- 10 ramos operativos y seleccionables en `DomainSelector.tsx`.
- Carga limpia de taxonomías y tesauros para `equipo_maquinaria` y `casco_embarcacion`.
- Formulario de clientes adaptado con datos técnicos marítimos y de maquinaria.
- Pruebas unitarias de tipado y registro de taxonomía pasando al 100%.
