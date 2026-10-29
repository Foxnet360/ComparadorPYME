# Política de Anonimización, Gobernanza de Datos y Modelo DaaS (Data as a Service)

## 1. Marco Normativo y Propósito

El presente documento establece los principios técnicos y legales que rigen la transformación de la información transaccional de **Comparador CSA** en activos de información despersonalizados para el modelo **DaaS (Data as a Service)**.

Esta política asegura el cumplimiento integral de:
- **Ley Estatutaria 1581 de 2012** (Régimen General de Protección de Datos Personales en Colombia).
- **Decreto 1377 de 2013** (Reglamentación de Habeas Data).
- **Circular Básica Jurídica (C.E. 029/2014)** de la Superintendencia Financiera de Colombia en materia de seguridad de la información y secreto comercial.

---

## 2. Principio Rector: Disociación Irreversible

Para que los datos derivados de las cotizaciones y pólizas puedan explotarse como servicio sin requerir consentimiento explícito para fines secundarios ni vulnerar el secreto comercial de las corredurías aliadas:

> **Regla de Oro:** Ningún registro dentro del repositorio analítico `public.daas_market_snapshots` o consumido vía API DaaS debe permitir la identificación directa o indirecta de personas naturales, personas jurídicas tomadoras/aseguradas, ni de la correduría que originó la cotización.

---

## 3. Matriz de Tratamiento de Atributos

| Categoría | Atributo Original | Tratamiento en Ingesta DaaS | Destino en `daas_market_snapshots` | Justificación |
| :--- | :--- | :--- | :--- | :--- |
| **Identificación Personal (PII)** | Nombre del Cliente / Tomador | **ELIMINACIÓN TOTAL** | *Excluido* | Dato personal directo. |
| **Identificación Tributaria** | NIT / Cédula de Ciudadanía | **ELIMINACIÓN TOTAL** | *Excluido* | Identificador unívoco. |
| **Ubicación Específica** | Dirección, Edificio, Nomenclatura | **ELIMINACIÓN TOTAL** | *Excluido* | Riesgo de geolocalización puntual. |
| **Bienes Asegurados Individuales** | Placa vehicular, Chasis, Matrícula inmobiliaria | **ELIMINACIÓN TOTAL** | *Excluido* | Permite reidentificación inmediata. |
| **Contacto** | Teléfono, Celular, Correo Electrónico | **ELIMINACIÓN TOTAL** | *Excluido* | PII sensible. |
| **Correduría / Tenant** | `org_id`, Razón social del intermediario | **DISOCIACIÓN** | *Excluido del snapshot* | Protege el secreto comercial de la agencia. |
| **Variables Actuariales (Valor)** | Ramo de Seguro (`domain`) | **PRESERVACIÓN** | `domain` | Esencial para benchmarking. |
| **Variables Actuariales (Valor)** | Aseguradora (`insurer_name`) | **PRESERVACIÓN** | `insurer_name` | Necesario para análisis de mercado. |
| **Variables Actuariales (Valor)** | Prima Anual / Mensual | **NORMALIZACIÓN** | `price_annual`, `price_monthly` | Valor monetario numérico sin sesgo. |
| **Condiciones de Cobertura** | Nombres de Amparos y Deducibles | **LIMPIEZA SEMÁNTICA** | `coverages_summary`, `deductibles_raw` | Se filtran posibles textos libres que contengan nombres. |
| **Temporalidad** | Fecha exacta y hora del estudio | **GENERALIZACIÓN** | `period_month` (ej: '2026-10') | Previene inferencia por timestamp cruzado. |
| **Geografía Macro** | Ciudad / Departamento | **AGRUPACIÓN MACRO** | `region_macro` ('NACIONAL', 'BOGOTA', etc.) | Solo nivel región/departamento. |

---

## 4. Salvaguardas contra Reidentificación (K-Anonimato y Umbral Mínimo)

Para evitar ataques de reconstrucción o vinculación cruzada de registros singulares:

1. **Umbral de Muestra Mínima ($k \ge 5$):**
   Las APIs y vistas públicas de DaaS no publican estadísticas ni benchmarks si el tamaño muestral para un ramo, período o aseguradora específica es inferior a 5 cotizaciones.
2. **Sin Enlace de Retorno Público:**
   El campo `source_analysis_id` solo es visible a nivel interno para tareas de auditoría forense (`super_admin`), y se excluye de cualquier proyección de la API externa de DaaS.
3. **Agregaciones Estadísticas Protegidas:**
   En consultas de dispersión de primas, se proporcionan percentiles (P25, Mediana P50, P75) y medias recortadas, evitando publicar valores extremos atípicos que puedan correlacionarse con una mega-cuenta corporativa conocida.

---

## 5. Auditoría y Control de Acceso

- Todo consumo de datos de mercado por clientes B2B (Aseguradoras, Reaseguradoras) debe autenticarse mediante API Keys registradas en `public.daas_api_usage`.
- Se registra telemetría de cada query: IP, endpoint, parámetros consultados y timestamp.
- Revisiones periódicas semestrales para auditar que ninguna actualización del pipeline de extracción IA introduzca texto libre no saneado en `coverages_summary`.
