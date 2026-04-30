# 🗺️ Tesauro de Extensiones (Sub-límites y Amparos Adicionales) para Ramo PYME

> **Archivo complementario:** Este documento extiende `tesauro(pyme).md` con sub-límites, amparos adicionales y riders comunes encontrados en cotizaciones de seguros patrimoniales.
>
> **Estructura:** Concepto Padre (del tesauro principal) → Lista de Sub-límites/Amparos

---

## 1. Sub-límites de Incendio y Líneas Aliadas (ILA)

| Concepto Padre | Sub-límite / Amparo | Variantes Comunes |
|---|---|---|
| **Incendio y Líneas Aliadas (ILA)** | Remoción de Escombros | Remocion de escombros, Gastos de remoción, Limpieza de escombros |
| **Incendio y Líneas Aliadas (ILA)** | Honorarios Profesionales | Honorarios profesionales, Gastos de peritos, Honorarios de auditores, Honorarios de arquitectos |
| **Incendio y Líneas Aliadas (ILA)** | Gastos de Extinción del Siniestro | Extinción del fuego, Gastos de extinción, Medios de extinción, Costos de bomberos |
| **Incendio y Líneas Aliadas (ILA)** | Preservación de Bienes | Gastos de preservación, Bienes no destruidos, Protección de bienes, Salvamento |
| **Incendio y Líneas Aliadas (ILA)** | Gastos de Reposición de Archivos | Reposición de archivos, Reconstrucción de documentos, Recuperación de registros |
| **Incendio y Líneas Aliadas (ILA)** | Gastos Adicionales | Gastos adicionales, Costos extraordinarios, Gastos de emergencia |
| **Incendio y Líneas Aliadas (ILA)** | Propiedad Personal de Empleados | Propiedad de empleados, Bienes personales del personal, Efectos personales |
| **Incendio y Líneas Aliadas (ILA)** | Bienes Bajo Cuidado, Tenencia y Control | Bienes de terceros, Bienes en custodia, Mercancías bajo control |

---

## 2. Sub-límites de Equipo Electrónico

| Concepto Padre | Sub-límite / Amparo | Variantes Comunes |
|---|---|---|
| **Equipo Electrónico (Daño Interno)** | Equipos Móviles y Portátiles | Equipos móviles, Portátiles, Tablets, Celulares, Laptops |
| **Equipo Electrónico (Daño Interno)** | Corto Circuito y Sobretensión | Corto circuito, Sobretensión, Daño por tensión, Falla eléctrica |
| **Equipo Electrónico (Daño Interno)** | Equipos de Reemplazo | Equipo de reemplazo, Equipos de préstamo, Equipos sustitutos |

---

## 3. Riders y Amparos Adicionales

| Concepto Padre | Tipo | Amparo / Rider | Variantes Comunes |
|---|---|---|---|
| **Incendio y Líneas Aliadas (ILA)** | Rider | Amparo Automático de Nuevos Bienes | Nuevos bienes, Amparo automático, Bienes adquiridos |
| **Incendio y Líneas Aliadas (ILA)** | Rider | Amparo de Traslado Temporal de Bienes | Traslado temporal, Mudanza temporal, Bienes en tránsito interno |
| **Incendio y Líneas Aliadas (ILA)** | Rider | Amparo para Bienes en Ferias y Exposiciones | Ferias, Exposiciones, Bienes en exhibición, Eventos |
| **Incendio y Líneas Aliadas (ILA)** | Rider | Amparo de Equipos de Reemplazo | Equipos de reemplazo, Préstamo de equipos, Equipos sustitutos |
| **Transporte de Mercancías** | Rider | Transporte de Valores | Valores en tránsito, Transporte de dinero, Mensajería de valores |
| **Sustracción con Violencia** | Rider | Sustracción sin Violencia | Hurto simple, Sustracción menor, Hurto no calificado |

---

## 4. Gastos Operativos y Lucro Cesante

| Concepto Padre | Sub-límite / Amparo | Variantes Comunes |
|---|---|---|
| **Lucro Cesante** | Pérdida de Beneficios | Pérdida de beneficios, Pérdida de ganancias, Pérdida de utilidad |
| **Lucro Cesante** | Interrupción de Negocios | Interrupción de negocios, Paralización, Suspensión de operaciones |
| **Lucro Cesante** | Gastos Fijos y Utilidad Neta | Gastos fijos, Utilidad neta, Costos operativos fijos |
| **Lucro Cesante** | Gastos por Alojamiento Temporal | Alojamiento temporal, Pérdida de arrendamiento, Gastos de traslado temporal |
| **Lucro Cesante** | Gastos de Investigación y Ajuste | Investigación de reclamos, Ajuste de siniestros, Gastos de ajustadores |

---

## 5. Responsabilidad Civil - Extensiones

| Concepto Padre | Sub-límite / Amparo | Variantes Comunes |
|---|---|---|
| **Responsabilidad Civil (RCE)** | RC Patronal | Culpa patronal, Exceso de ARL, Accidentes de trabajo |
| **Responsabilidad Civil (RCE)** | RC Productos | Productos defectuosos, RC por calidad, Garantía de productos |
| **Responsabilidad Civil (RCE)** | RC Profesional | Errores y omisiones, Negligencia profesional, E&O |
| **Responsabilidad Civil (RCE)** | RC Parqueaderos | Vehículos en parqueadero, Posesión de vehículos de terceros |

---

## 🏷️ Clasificación de Tipos

Para facilitar el procesamiento automático, cada entrada en este tesauro tiene un tipo:

- **`sub-limit`**: Coberturas con suma asegurada menor que el amparo principal (ej: Remoción de Escombros = 20% de la suma asegurada de Incendio)
- **`rider`**: Amparos adicionales que amplían la cobertura principal (ej: Amparo Automático de Nuevos Bienes)
- **`extension`**: Coberturas que extienden el alcance geográfico o temporal (ej: Bienes en Ferias)
- **`gastos`**: Coberturas de gastos operativos o consecuenciales (ej: Honorarios Profesionales)

---

## 🔄 Flujo de Uso

1. El agente extrae todos los items de la cotización (coberturas + sub-límites + riders)
2. Primero intenta mapear contra `tesauro(pyme).md` (coberturas principales)
3. Si no hay coincidencia, intenta contra `tesauro-extensiones.md` (sub-límites y riders)
4. Si es un sub-límite, lo asocia con su cobertura padre
5. Si es un rider, lo marca como amparo adicional
6. Los items no mapeados se marcan para revisión manual
