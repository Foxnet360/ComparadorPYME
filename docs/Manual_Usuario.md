# 📖 Manual de Usuario Completo: Agente Comparador de Pólizas y Clausulados CSA

Este documento constituye el manual de usuario técnico y operativo del **Agente Comparador de Pólizas y Clausulados CSA**. Describe detalladamente cada flujo de trabajo, interfaz, componente interactivo y regla de negocio implementada en el sistema.

> **Instrucciones para la IA Generadora de Imágenes / Mockups UI:**  
> Cada sección incluye recuadros señalizados con el formato `![[IMAGEN_PLACEHOLDER: ...]]` que contienen las especificaciones detalladas (prompt de generación, composición de pantalla, datos visibles, estados de botones y anotaciones) requeridas para construir o renderizar las capturas visuales correspondientes.

---

## Tabla de Contenidos
1. [Introducción y Visión General](#1-introducción-y-visión-general)
2. [Arquitectura de Datos y Reglas de Negocio Clave](#2-arquitectura-de-datos-y-reglas-de-negocio-clave)
3. [Acceso, Autenticación y Perfil de Usuario](#3-acceso-autenticación-y-perfil-de-usuario)
4. [Dashboard Técnico e Historial de Auditorías](#4-dashboard-técnico-e-historial-de-auditorías)
5. [Gestión de Clientes y Copropiedades (Client Manager)](#5-gestión-de-clientes-y-copropiedades-client-manager)
6. [Módulo de Nueva Auditoría (Configuración y Carga de Archivos)](#6-módulo-de-nueva-auditoría-configuración-y-carga-de-archivos)
7. [Reporte Comparativo Integral (Comparison Report)](#7-reporte-comparativo-integral-comparison-report)
8. [Asistente Virtual Interactivo (SeguroBot - Triple Fuente)](#8-asistente-virtual-interactivo-segurobot---triple-fuente)
9. [Biblioteca Administrable de Clausulados (Clause Library Admin)](#9-biblioteca-administrable-de-clausulados-clause-library-admin)
10. [Glosario Técnico y Solución de Problemas](#10-glosario-técnico-y-solución-de-problemas)

---

## 1. Introducción y Visión General

El **Agente Comparador CSA** es una plataforma de inteligencia artificial especializada en el sector asegurador (orientada a ramos como **Seguros PYME**, **Copropiedades** y **Autos**). Su objetivo principal es automatizar la lectura, extracción, normalización semántica, auditoría técnica y comparación profunda de cotizaciones emitidas por distintas aseguradoras (ej. Suramericana, SBS, AXA Colpatria, Mapfre, Bolívar, Seguros del Estado, Chubb), contrastándolas directamente contra los clausulados generales y particulares registrados.

### 1.1 Roles de Usuario
- **Usuario Técnico / Asesor Comercial:** Realiza auditorías de cotizaciones, genera cuadros comparativos, analiza riesgos de deducibles y presenta ofertas a clientes.
- **Administrador:** Gestiona la biblioteca oficial de clausulados versionados, supervisa las métricas de aprendizaje del sistema y administra usuarios de la corredora.

---

## 2. Arquitectura de Datos y Reglas de Negocio Clave

Para garantizar una auditoría precisa y libre de alucinaciones, el sistema opera bajo cinco pilares de negocio:

1. **Ontología Fluida y Mapeo Probabilístico de Coberturas:**
   En lugar de forzar los amparos a categorías rígidas predefinidas, el sistema utiliza una ontología probabilística basada en vectores embeddings y tesauros por ramo. Esto permite agrupar variaciones de nombres (ej. *"Amparo Básico Incendio"*, *"Incendio y Líneas Aliadas"*, *"Daños Materiales Básicos"*) en términos canónicos estandarizados sin perder la redacción original.

2. **Parser Semántico de Deducibles Compuestos:**
   Los deducibles de pólizas colombianas combinan porcentajes, mínimos expresados en Salarios Mínimos Mensuales Legales Vigentes (SMMLV) y topes máximos (ej. *"10% del valor del siniestro, mínimo 5 SMMLV, máximo 50 SMMLV"*). El motor analiza semánticamente la estructura y calcula el riesgo financiero real expuesto por la aseguradora.

3. **Arquitectura de Triple Fuente de Verdad (Anti-Alucinación):**
   Al responder consultas o calificar coberturas, la prioridad de validación es estricta:
   - **Prioridad 1 (Cotización):** Datos explícitos extraídos del documento PDF/Imagen subido.
   - **Prioridad 2 (Clausulado RAG):** Fragmentos validados del clausulado oficial almacenado en Supabase (Embeddings de 3072 dimensiones).
   - **Prioridad 3 (Conocimiento Técnico General):** Aplicado únicamente para aclaraciones conceptuales, marcando explícitamente la fuente.

4. **Clausulados Versionados (Auto-Archivado):**
   Cada clausulado en la biblioteca se identifica mediante la clave unívoca `Aseguradora + Tipo de Documento + Producto`. Al subir una nueva versión del clausulado, la versión previa pasa automáticamente a estado *Archivado* (`is_active = false`), asegurando que las búsquedas RAG solo utilicen la normativa vigente.

5. **Aislamiento por Ramo Comercial (`InsuranceDomain`):**
   Los tesauros, reglas de puntuación y agrupaciones de coberturas están totalmente aislados según el ramo seleccionado (`pyme`, `autos`, `copropiedades`), permitiendo comparaciones adaptadas a la naturaleza de cada riesgo.

---

## 3. Acceso, Autenticación y Perfil de Usuario

### 3.1 Pantalla de Inicio (Landing Page)
Punto de entrada a la plataforma donde se presentan los beneficios principales del comparador inteligente, casos de uso y botones de acción.

- **Acciones Disponibles:**
  - Botón **"Iniciar Sesión"**: Redirige al formulario de autenticación.
  - Botón **"Registrarse"**: Redirige al formulario de creación de cuenta.

```markdown
![[IMAGEN_PLACEHOLDER: UI_01_LANDING_PAGE | Prompt: UI mockup of modern SaaS Landing Page for insurance broker comparison tool named 'Agente Comparador CSA'. Hero section with title 'Auditoría Inteligente de Cotizaciones y Clausulados', deep blue and slate theme, clean typography, CTA buttons 'Iniciar Sesión' and 'Registrarse', feature cards highlighting AI RAG audit, deductible risk gauges, and side-by-side coverage matrix. Figma style, crisp resolution.]]
```

---

### 3.2 Iniciar Sesión (Login)
Formulario de ingreso para usuarios registrados. Requiere correo electrónico y contraseña.

- **Pasos:**
  1. Ingrese su correo corporativo.
  2. Ingrese su contraseña.
  3. Haga clic en **"Iniciar Sesión"**. Si las credenciales son válidas, el sistema lo redirigirá al **Dashboard Técnico**.

```markdown
![[IMAGEN_PLACEHOLDER: UI_02_LOGIN_SCREEN | Prompt: Modern login screen interface for Agente Comparador CSA. Central white card with rounded border, input fields for 'Correo Electrónico' and 'Contraseña', primary indigo button 'Iniciar Sesión', link '¿No tienes cuenta? Regístrate aquí'. Clean background with subtle geometric gradients.]]
```

---

### 3.3 Registro de Usuario (Register)
Permite el alta de nuevos asesores o administradores dentro de la corredora.

- **Campos del Formulario:**
  - Nombre completo.
  - Correo electrónico.
  - Contraseña y Confirmación de contraseña.
  - Rol (`TECHNICAL` para Asesor/Analista, `ADMIN` para Administrador de Biblioteca).
  - Nombre de la Corredora / Intermediario.

```markdown
![[IMAGEN_PLACEHOLDER: UI_03_REGISTER_SCREEN | Prompt: User registration modal interface. Form fields: Full Name, Work Email, Password, Role selector dropdown ('Asesor Técnico', 'Administrador'), Intermediary Broker Name. Indigo primary button 'Crear Cuenta', link to back to Login. Clean UI design.]]
```

---

### 3.4 Perfil de Usuario y Configuración
Accesible desde la barra superior haciendo clic en el avatar del usuario. Permite actualizar la información del agente y la parametrización de la corredora.

- **Funcionalidades:**
  - Carga de fotografía de perfil y logotipo de la corredora (usado en la exportación de reportes PDF).
  - Edición de teléfono de contacto, número de registro ante la Superfinanciera, dirección y ciudad.
  - Selección del ramo por defecto (`Seguros PYME` o `Seguros Autos`).

```markdown
![[IMAGEN_PLACEHOLDER: UI_04_PROFILE_SCREEN | Prompt: Profile settings modal screen. Left sidebar with avatar upload and broker logo upload zone. Right main form with fields: Full Name, Registration Number, Phone, Address, City, Default Domain toggle ('PYME' / 'Autos'). 'Guardar Cambios' button in bottom right.]]
```

---

## 4. Dashboard Técnico e Historial de Auditorías

El **Dashboard Técnico** es el centro de control de operaciones del asesor. Ofrece métricas de rendimiento comercial y el historial unificado de comparativos realizados.

```markdown
![[IMAGEN_PLACEHOLDER: UI_05_TECHNICAL_DASHBOARD | Prompt: Technical dashboard interface for insurance agent. Top bar with metrics cards: 'Cotizaciones Auditadas' (124), 'Tasa de Conversión' (68%), 'Prima Total Vendida' ($450M COP), 'Prospectos Activos' (15). Main area with search bar, filter tabs ('Todas', 'Borrador', 'Enviadas', 'Vendidas', 'Perdidas'), button '+ Nueva Auditoría', and interactive data table of past audits with columns: Fecha, Cliente, Aseguradoras, Opción Ganadora, Prima, Estado, Acciones (Ver Reporte, Cambiar Estado).]]
```

### 4.1 Métricas Clave (KPIs)
- **Total Cotizaciones:** Número total de auditorías procesadas en el periodo.
- **Tasa de Conversión:** Porcentaje de cotizaciones que pasaron a estado *Vendida*.
- **Prima Total Vendida:** Suma acumulada de primas cerradas en moneda local.
- **Prospectos Activos:** Comparativos en estado *Borrador* o *Enviada*.

### 4.2 Tabla de Historial y Filtros
- **Filtros por Estado:** Permite segmentar el historial entre *Borrador*, *Enviada*, *Vendida* y *Perdida*.
- **Buscador:** Filtrado en tiempo real por nombre de cliente o aseguradora.
- **Acciones:**
  - **Ver Reporte:** Reabre el informe comparativo interactivo completo.
  - **Cambiar Estado:** Actualiza el ciclo de vida de la propuesta comercial.

---

## 5. Gestión de Clientes y Copropiedades (Client Manager)

Este módulo gestiona la información técnica y de georreferenciación de los clientes (Empresas PYME, Copropiedades Residenciales o Comerciales).

```markdown
![[IMAGEN_PLACEHOLDER: UI_06_CLIENT_MANAGER | Prompt: Client management screen interface. Header with search bar and button '+ Nuevo Cliente'. Table listing clients with columns: Razón Social / Copropiedad, NIT, Ciudad/Depto, Zona Sísmica, Edificación, Auditorías Realizadas, Acciones ('Nueva Auditoría', 'Editar'). Sidebar drawer showing selected client technical specs: 3 Towers, 12 Floors, Construction Year 2018, High Seismic Zone, Elevators Yes, Power Plant Yes.]]
```

### 5.1 Ficha Técnica del Cliente / Copropiedad
Al registrar o editar un cliente, se capturan variables críticas para la auditoría de riesgos:
- **Datos Básicos:** Razón Social / Nombre del Edificio, NIT, Persona de Contacto, Correo, Teléfono.
- **Geolocalización:** Dirección, Ciudad, Departamento, Latitud y Longitud.
- **Parametrización de Riesgo Físico:**
  - **Zona Sísmica:** *Alta*, *Intermedia* o *Baja* (determina la severidad en auditoría de deducibles de Terremoto).
  - **Tipo de Edificación:** *Residencial*, *Comercial* o *Mixta*.
  - **Estructura Física:** Número de torres, número de unidades/apartamentos, pisos de altura, año de construcción.
  - **Equipamiento:** Presencia de ascensores y planta eléctrica (evalúa la necesidad de amparo de Equipo Electrónico y Rotura de Maquinaria).

---

## 6. Módulo de Nueva Auditoría (Configuración y Carga de Archivos)

El flujo de creación de auditoría consta de tres pasos principales organizados en una pantalla unificada:

```markdown
![[IMAGEN_PLACEHOLDER: UI_07_ANALYZER_UPLOAD_SCREEN | Prompt: Step-by-step audit setup interface. Top section: Client selector dropdown ('Edificio Torres del Parque') and Domain toggle pills ('Seguros PYME' active / 'Seguros Autos'). Main body split in two dropzones: Left dropzone titled '1. Cotizaciones (Input)' with uploaded file chips (Suramericana_PYME.pdf, Mapfre_Oferta.pdf) and drag-and-drop area; Right section titled '2. Clausulados Referenciales' showing tab toggle ('Biblioteca RAG' / 'Subir PDFs') with active selected clauses list (AXA Clausulado 2024, SBS General 2023). Bottom right primary action button 'Analizar Cotizaciones (2 Referencias)'.]]
```

### 6.1 Pasos para Ejecutar una Auditoría

1. **Seleccionar Cliente y Ramo:**
   - Seleccione el cliente registrado en el menú desplegable. Los datos de su ficha técnica alimentarán las alertas contextuales.
   - Seleccione el ramo comercial (`Seguros PYME` o `Seguros Autos`).

2. **Cargar Ofertas / Cotizaciones (Archivos de Entrada):**
   - Arrastre o seleccione los archivos PDF o imágenes (PNG/JPG) de las cotizaciones a comparar (mínimo 1, recomendado de 2 a 4 aseguradoras).
   - El sistema admite PDFs multipágina con tablas y formatos escaneados mediante OCR semántico.

3. **Configurar Clausulados Referenciales (Base de Auditoría RAG):**
   - **Opción A (Biblioteca RAG - Recomendado):** Marque los clausulados oficiales previamente aprobados en la base de datos.
   - **Opción B (Subida Directa):** Suba archivos PDF de clausulados específicos para este análisis en el panel derecho.

4. **Iniciar Procesamiento:**
   - Haga clic en **"Analizar Cotizaciones"**.

```markdown
![[IMAGEN_PLACEHOLDER: UI_08_ANALYSIS_PROGRESS_STATE | Prompt: Analysis loading and reasoning screen. Central circular pulsing loader in indigo color. Text prompt 'Auditando Clausulados...', subtitle 'Procesando información de Edificio Torres del Parque'. Animated status message switcher: 'Extrayendo coberturas mediante modelo de razonamiento...', 'Parseando deducibles compuestas a SMMLV...', 'Consultando vector DB Supabase (3072d)...'. Bottom pill banner with icon 'Aplicando razonamiento profundo (Thinking Model)'. Clean modern progress UI.]]
```

---

## 7. Reporte Comparativo Integral (Comparison Report)

Una vez completado el procesamiento, la plataforma despliega el reporte técnico estructurado en 8 pestañas/componentes clave:

### 7.1 Resumen Ejecutivo y Puntuación Técnica

```markdown
![[IMAGEN_PLACEHOLDER: UI_09_EXECUTIVE_SUMMARY | Prompt: Executive summary tab of comparison report. Top header with overall comparison score badge (88/100 - Suramericana, 74/100 - Mapfre). Grid of 2 text cards: 'Análisis para el Cliente' (bulleted non-technical commercial summary) and 'Análisis Técnico Especializado' (deep technical evaluation with sublimit breakdowns). Quality metrics bar showing Data Quality Score (96%), Verification Confidence (92%), and Extraction Confidence (95%). Bottom banner highlighting 'Opción Recomendada: Suramericana'.]]
```

- **Score Técnico (0 a 100):** Algoritmo ponderado que evalúa:
  - Amplitud de coberturas (30%)
  - Nivel de riesgo en deducibles (25%)
  - Ausencia de exclusiones críticas (20%)
  - Ratio costo/beneficio de prima (15%)
  - Sublímites y garantías (10%)
- **Análisis Dual:**
  - **Vista Cliente:** Redacción clara y ejecutiva para presentar al asegurado.
  - **Vista Técnica:** Detalle riguroso con métricas de sublímites y clausulados para el corredor.

---

### 7.2 Matriz Unificada de Coberturas (Variable a Variable)

```markdown
![[IMAGEN_PLACEHOLDER: UI_10_UNIFIED_COVERAGE_MATRIX | Prompt: Unified coverage matrix table. Sticky left column with coverage canonical names ('Incendio Edificio', 'Terremoto y TTEV', 'Sustracción con Violencia', 'Lucro Cesante', 'RCE Predios Operaciones'). Columns for Insurer A (Suramericana) and Insurer B (Mapfre). Cells display extracted values, sublimits, green 'Winner' badge icons, red 'Exclusión' tags, and confidence scores (e.g. 98% Thesaurus match). Top bar with search input and toggle filter 'Solo diferencias'. Floating tooltip on hover showing exact page citation (Pág. 4, Secc. 2).]]
```

- **Comparación Fluida:** No fuerza categorías. Si una aseguradora incluye un amparo exclusivo (ej. *"Gastos de Alojamiento Temporal"*), este se posiciona como una fila independiente destacando su ventaja competitiva.
- **Indicadores en Celda:**
  - Badge **Ganador (Winner):** Destaca la mejor oferta en ese amparo.
  - Tag **Exclusión:** Indica si el amparo está expresamente excluido en esa póliza.
  - **Cita y Confianza:** Porcentaje de certeza de coincidencia semántica y acceso a la cita fuente en el PDF.

---

### 7.3 Matriz de Deducibles y Gauges de Riesgo

```markdown
![[IMAGEN_PLACEHOLDER: UI_11_DEDUCTIBLE_MATRIX_AND_GAUGES | Prompt: Deductible analysis section. Matrix comparing deductibles by coverage for 3 insurers. Next to each deductible text (e.g. '10% min 5 SMMLV') is a Deductible Risk Gauge meter (speedometer style widget with needle indicating LOW green, MEDIUM yellow, HIGH orange, CRITICAL red risk). Dedicated card comparing Terremoto deductible impact in COP currency for a $1.000M COP claim.]]
```

- **Desglose de Deducibles Compuestos:** Muestra los componentes parseados: Porcentaje del siniestro, Mínimo en SMMLV, Tope Máximo y aplicación de deducible directo.
- **Gauge de Riesgo Financiero:**
  - **Verde (Bajo):** Deducible acorde o superior al estándar del mercado.
  - **Rojo/Crítico:** Deducible excesivo (ej. *"15% valor pérdida mínimo 20 SMMLV en zona de alta sismicidad"*).

---

### 7.4 Alertas Contextuales y Coberturas Inversas

```markdown
![[IMAGEN_PLACEHOLDER: UI_12_CONTEXTUAL_ALERTS_CARD | Prompt: Contextual risk and exclusion alerts section. Alert cards sorted by severity (CRITICAL red, WARNING yellow, INFO blue). Card 1: Critical alert titled 'Exclusión de Façade / Fachadas en Edificio de >10 Pisos', showing explanation, source document reference, and mitigation action. Card 2: Inverse coverage alert showing Mapfre excludes water damage while Suramericana covers it 100%.]]
```

- **Cobertura Inversa:** Detecta situaciones donde una póliza A otorga cobertura total mientras la póliza B la excluye explícitamente en el clausulado.
- **Alertas de Perfil:** Cruzan los datos técnicos del cliente (ej. edificio del año 1985 sin planta eléctrica) con exclusiones de obsolescencia o falta de mantenimiento.

---

### 7.5 Radar de Aseguradoras y Mapa de Calor de Riesgos

```markdown
![[IMAGEN_PLACEHOLDER: UI_13_INSURER_RADAR_HEATMAP | Prompt: Visual comparison charts tab. Left widget: Radar Chart (InsurerRadar) displaying multi-axis radar comparison for Suramericana vs Mapfre across 6 dimensions: Coberturas, Deducibles, Exclusiones, Ratio Precio, Sublímites, Garantías. Right widget: Risk Heatmap matrix grid representing coverage categories color-coded from dark green (low risk) to bright red (high risk).]]
```

- **Radar Multidimensional:** Compara visualmente el desempeño integral de las cotizaciones evaluadas.
- **Mapa de Calor:** Identifica de forma inmediata qué áreas de protección quedan descubiertas o vulnerables entre las diferentes propuestas.

---

### 7.6 Dictamen Legal y Puntos de Negociación

```markdown
![[IMAGEN_PLACEHOLDER: UI_14_LEGAL_OPINION_NEGOTIATION | Prompt: Legal opinion and negotiation points interface. Top card with legal opinion title 'Dictamen Jurídico en Escenario de Siniestro Catastrófico', citing Law 45 of 1990 and specific policy clauses. Bottom section displaying prioritized list of negotiation points for the broker: High Priority card 'Solicitar eliminación de sublímite en Remoción de Escombros (Ahorro potencial: $50M COP)', button 'Copiar Puntos para Correo'.]]
```

- **Dictamen Jurídico:** Interpretación legal de cláusulas ambiguas o garantistas que podrían perjudicar al cliente en un eventual reclamo.
- **Argumentos de Negociación:** Sugerencias concretas para que el corredor solicite modificaciones de condiciones a la aseguradora antes del cierre.

---

### 7.7 Visor PDF e Inspección de Evidencias

```markdown
![[IMAGEN_PLACEHOLDER: UI_15_PDF_VIEWER_EVIDENCE | Prompt: Integrated PDF viewer modal split interface. Left panel showing extracted evidence card with text snippet, similarity score 94%, Page 7 Section 3. Right panel embedding actual PDF quote document with highlighted text matching the citation. Jump-to-page navigation controls and zoom toolbar.]]
```

- **Trazabilidad 100% Auditable:** Cada celda o afirmación en la matriz incluye un hipervínculo directo al documento fuente. Al hacer clic, el visor de PDF integrado salta automáticamente a la página exactas destacando el fragmento analizado.

---

### 7.8 Corrección Manual y Aprendizaje Continuo (Feedback Loop)

```markdown
![[IMAGEN_PLACEHOLDER: UI_16_MANUAL_CORRECTION_INTERFACE | Prompt: Manual cell editing and correction UI. Hover overlay over matrix cell showing edit icon. Modal popup titled 'Corregir Mapeo Semántico': Dropdown to reassign canonical category, text area for custom deductible correction, and checkbox 'Guardar en Tesauro para futuras auditorías'. Buttons 'Cancelar' and 'Aplicar Corrección'.]]
```

- **Edición en Línea:** Permite al asesor ajustar valores extraídos o renombrar coberturas directamente en la pantalla.
- **Retroalimentación al Engine:** Las correcciones confirmadas alimentan la base de conocimientos (`coverage_mappings`), permitiendo que las futuras cotizaciones de esa aseguradora se procesen con mayor precisión.

---

## 8. Asistente Virtual Interactivo (SeguroBot - Triple Fuente)

Accesible desde el botón **"SeguroBot"** presente en el reporte comparativo. Es un chat de inteligencia artificial conversacional entrenado para absolver dudas específicas sobre el comparativo actual.

```markdown
![[IMAGEN_PLACEHOLDER: UI_17_SEGUROBOT_CHAT_INTERFACE | Prompt: Floating side-chat panel 'SeguroBot'. Conversation history: User asks '¿Cuál aseguradora tiene mejor deducible para rotura de maquinaria y por qué?'. SeguroBot response breaking down comparison, citing Suramericana (10% min 3 SMMLV) vs Mapfre (15% min 5 SMMLV), with green source tag 'Cotización Extraída' and clickable citation chip 'Clausulado AXA pág. 12'. Text box at bottom with send button and prompt suggestions.]]
```

### 8.1 Reglas del Chat
- **Citas Activas:** Cada respuesta incluye enlaces a las páginas de la cotización o clausulado donde se sustenta la información.
- **Filtro Anti-Alucinación:** Si una cobertura no figura en los documentos cargados ni en la biblioteca RAG, SeguroBot indicará expresamente que el amparo no consta en los documentos auditados.

---

## 9. Biblioteca Administrable de Clausulados (Clause Library Admin)

Módulo exclusivo para usuarios con rol `ADMIN`. Permite gestionar los documentos normativos de referencia que utiliza el motor RAG.

```markdown
![[IMAGEN_PLACEHOLDER: UI_18_CLAUSE_ADMIN_LIBRARY | Prompt: Clause library administration screen. Top toolbar with filter dropdowns (Aseguradora, Tipo Documento, Estado: Activo/Archivado) and primary button '+ Subir Nuevo Clausulado'. Data table showing list of stored documents: Aseguradora, Producto, Tipo (CLAUSULADO_GENERAL), Versión (2024.1), Páginas, Estado badge (Active green / Archived grey), Tokens Estimados, Acciones (Ver Secciones, Archivar, Eliminar). Upload modal showing PDF dropzone and metadata fields (Insurer ID, Product Name, Document Type enum).]]
```

### 9.1 Acciones Administrativas
- **Subir Clausulado Oficial:** Carga de archivo PDF, selección de Aseguradora, Nombre de Producto, Versión y Tipo (`CLAUSULADO_GENERAL`, `CLAUSULADO_PARTICULAR` o `ANEXO`).
- **Indexación Automática:** El sistema extrae el texto, genera embeddings de 3072 dimensiones y almacena los vectores en Supabase.
- **Gestión de Versiones:** Si se sube una nueva versión para un producto existente, el sistema archiva automáticamente la versión anterior.

---

## 10. Glosario Técnico y Solución de Problemas

### 10.1 Glosario de Términos
- **RAG (Retrieval-Augmented Generation):** Técnica que combina búsqueda vectorial de clausulados en base de datos con modelos de lenguaje para responder con precisión factual.
- **SMMLV:** Salario Mínimo Mensual Legal Vigente (base monetaria para mínimos de deducibles en Colombia).
- **Tesauro de Normalización:** Diccionario dinámico de sinónimos que homologa términos heterogéneos de aseguradoras a un concepto estándar.
- **Amparo Básico / ILA:** Incendio y Líneas Aliadas (cobertura matriz en pólizas de daños materiales/PYME).
- **RCE:** Responsabilidad Civil Extracontractual.
- **HMACC / AMIT:** Huelga, Motín, Asonada, Conmoción Civil / Actos Malintencionados de Terceros.

---

### 10.2 Preguntas Frecuentes y Solución de Problemas

| Problema / Incidencia | Causa Probable | Solución Recomendada |
|---|---|---|
| **El botón "Analizar" permanece deshabilitado.** | No se ha seleccionado un cliente o no se han subido archivos de cotización. | Verifique que haya seleccionado un cliente de la lista y que haya al menos una cotización cargada en el panel izquierdo. |
| **Deducible aparece como "Revisión Manual".** | La redacción del deducible en la cotización es altamente atípica o ilegible. | Use la herramienta de **Corrección Manual** en la matriz para ingresar los valores de porcentaje y SMMLV manualmente. |
| **El chat SeguroBot no responde sobre un amparo.** | El amparo no está en la cotización ni en los clausulados seleccionados. | Cargue el clausulado particular correspondiente en la auditoría o verifique si la cotización omitió dicha sección. |
| **Error al subir un clausulado en la Biblioteca.** | El archivo supera el tamaño máximo permitido o el formato no es PDF válido. | Verifique que el archivo sea un PDF legible y no exceda 50 MB. |

---

*Manual de Usuario - Agente Comparador CSA v2.0*  
*Documento optimizado para construcción e integración de elementos gráficos mediante generadores de IA.*
