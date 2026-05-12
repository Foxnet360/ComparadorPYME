# Documentación Normativa y Ética

## Comparador CSA - Fase 3

---

## 1. Consentimiento Informado para Participantes del Piloto

---

### CONSENTIMIENTO INFORMADO

**Proyecto**: Comparador de Seguros PYME - Sistema de Extracción Multimodal V2
**Versión**: 2.0
**Fecha**: 2025-01-12

---

#### 1. DESCRIPCIÓN DEL PROYECTO

Usted está siendo invitado a participar en el piloto de prueba del nuevo sistema de extracción automática de cotizaciones de seguros PYME. Este sistema utiliza inteligencia artificial (Gemini 2.5 Pro) para analizar documentos PDF de cotizaciones y extraer información relevante (coberturas, primas, deducibles).

#### 2. PROPÓSITO

Evaluar la precisión y velocidad del nuevo sistema comparado con el método actual, con el fin de mejorar el servicio de comparación de seguros para empresas colombianas.

#### 3. PROCEDIMIENTO

Si acepta participar:
- Se le pedirá subir cotizaciones de seguros en formato PDF
- El sistema procesará automáticamente los documentos
- Se compararán los resultados del sistema nuevo vs el anterior
- Los datos se usarán únicamente para mejorar el sistema

**Tiempo estimado**: 15-30 minutos por sesión de prueba

#### 4. RIESGOS Y BENEFICIOS

**Riesgos**:
- Mínimo: Los PDFs contienen información comercial ya compartida con aseguradoras
- Los datos no serán compartidos con terceros
- No se almacenarán PDFs permanentemente (se eliminan tras procesamiento)

**Beneficios**:
- Contribuir a mejorar el servicio para empresas colombianas
- Acceso prioritario a la nueva versión del sistema
- Posibles incentivos (descuentos en servicios futuros)

#### 5. CONFIDENCIALIDAD

- Toda la información se manejará de manera confidencial
- Los datos se anonimizarán para análisis estadístico
- Se cumple con la Ley 1581 de 2012 (Protección de Datos Personales)
- Los PDFs se eliminan automáticamente después del procesamiento

#### 6. PARTICIPACIÓN VOLUNTARIA

Su participación es completamente voluntaria. Puede:
- Negarse a participar sin ninguna consecuencia
- Retirarse en cualquier momento
- Pedir que se eliminen sus datos

#### 7. CONTACTO

Si tiene preguntas sobre este proyecto:
- **Responsable**: [Nombre del responsable]
- **Email**: [email@comparador-csa.com]
- **Teléfono**: [Número de contacto]

---

### DECLARACIÓN DEL PARTICIPANTE

He leído y comprendido la información anterior. He tenido la oportunidad de hacer preguntas y todas han sido respondidas satisfactoriamente.

**Acepto participar en el piloto**: ☐ Sí ☐ No

**Acepto que mis datos sean utilizados para mejorar el sistema**: ☐ Sí ☐ No

**Acepto recibir información sobre resultados del piloto**: ☐ Sí ☐ No

---

**Nombre del participante**: _________________________

**Documento de identidad**: _________________________

**Firma**: _________________________

**Fecha**: _________________________

---

## 2. Solicitud de Aval ante Comité de Ética

---

### SOLICITUD DE AVAL ÉTICO

**Fecha**: 2025-01-12
**Versión**: 2.0

---

#### 1. INFORMACIÓN GENERAL

| Campo | Valor |
|-------|-------|
| **Nombre del proyecto** | Comparador CSA - Extracción Multimodal V2 |
| **Línea de investigación** | Inteligencia Artificial aplicada a seguros |
| **Institución** | Comparador CSA |
| **Investigador principal** | [Nombre] |
| **Duración estimada** | 3 meses (Enero - Marzo 2025) |

#### 2. JUSTIFICACIÓN

El proyecto busca mejorar la extracción automática de datos de cotizaciones de seguros PYME mediante inteligencia artificial multimodal. La motivación es:

- Reducir errores en la comparación de cotizaciones (actualmente 35% de valores inventados)
- Disminuir tiempo de análisis de 2.4 minutos a menos de 1 minuto
- Mejorar precisión en detección de coberturas y deducibles

#### 3. METODOLOGÍA

**Fase 1** (Mes 1): Desarrollo del sistema
- Implementación de extracción multimodal con Gemini 2.5 Pro
- Creación de pipeline dual (V1 legacy + V2 multimodal)

**Fase 2** (Mes 2): Pruebas internas
- Tests unitarios y de integración
- Comparación V1 vs V2 con 50+ cotizaciones reales

**Fase 3** (Mes 3): Piloto controlado
- 20-30 usuarios prueban el sistema
- Recolección de métricas de precisión y velocidad
- Ajustes basados en feedback

#### 4. POBLACIÓN Y MUESTRA

- **Población**: Corredores de seguros y empresarios PYME en Colombia
- **Muestra**: 20-30 participantes voluntarios
- **Criterios de inclusión**: Usuarios activos del comparador, mayores de 18 años
- **Criterios de exclusión**: Menores de edad, personas sin capacidad para consentir

#### 5. RECOLECCIÓN DE DATOS

| Tipo de dato | Uso | Almacenamiento |
|-------------|-----|----------------|
| PDFs de cotizaciones | Procesamiento IA | Temporal (< 24h), encriptados |
| Resultados de extracción | Métricas de precisión | Anonimizados, base de datos segura |
| Feedback de usuarios | Mejoras del sistema | Consentimiento explícito |
| Logs de uso | Monitoreo de performance | Anonimizados, 30 días |

#### 6. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Fuga de datos comerciales | Baja | Alto | Encriptación, acceso restringido, eliminación automática |
| Sesgo algorítmico | Media | Medio | Diversidad en datos de prueba, auditoría manual |
| Dependencia de API externa | Alta | Medio | Fallback automático, monitoreo continuo |
| Errores en extracción | Media | Medio | Validación humana en resultados críticos |

#### 7. PRINCIPIOS ÉTICOS

- **Autonomía**: Consentimiento informado, participación voluntaria
- **Beneficencia**: Maximizar beneficios (mejor servicio), minimizar riesgos
- **No maleficencia**: No causar daño a participantes ni aseguradoras
- **Justicia**: Distribución equitativa de beneficios

#### 8. CONSIDERACIONES ESPECIALES

- **Datos sensibles**: Los PDFs contienen información comercial pero no datos personales identificables
- **Propiedad intelectual**: No se extrae ni copia contenido protegido de aseguradoras
- **Competencia**: El sistema no favorece ninguna aseguradora específica

#### 9. DOCUMENTACIÓN ADJUNTA

- [x] Consentimiento informado
- [x] Protocolo de investigación
- [x] Plan de manejo de datos
- [x] Plan de seguridad informática
- [ ] CV del investigador principal
- [ ] Cartas de colaboración (si aplica)

#### 10. DECLARACIÓN DEL INVESTIGADOR

Declaro que:
- La información proporcionada es veraz y completa
- Cumpliré con todos los procedimientos aprobados
- Informaré oportunamente cualquier evento adverso
- Respetaré los derechos de los participantes

**Firma del investigador**: _________________________

**Fecha**: _________________________

---

## 3. Tracker de Documentación Normativa

### Estado de Documentos Requeridos

| # | Documento | Estado | Responsable | Fecha Límite | Completado |
|---|-----------|--------|-------------|--------------|------------|
| 1 | Consentimiento informado | ✅ | [Nombre] | 2025-01-15 | 2025-01-12 |
| 2 | Solicitud aval comité ética | ✅ | [Nombre] | 2025-01-20 | 2025-01-12 |
| 3 | Plan de manejo de datos | ⏳ | [Nombre] | 2025-01-25 | - |
| 4 | Política de privacidad (actualizada) | ⏳ | [Nombre] | 2025-01-25 | - |
| 5 | Términos y condiciones | ⏳ | [Nombre] | 2025-01-30 | - |
| 6 | Plan de seguridad informática | ⏳ | [Nombre] | 2025-02-05 | - |
| 7 | Registro de tratamiento de datos (RUA) | ⏳ | [Nombre] | 2025-02-10 | - |
| 8 | Protocolo de respuesta a incidentes | ⏳ | [Nombre] | 2025-02-15 | - |
| 9 | Auditoría de seguridad | ⏳ | [Nombre] | 2025-03-01 | - |
| 10 | Informe final al comité ético | ⏳ | [Nombre] | 2025-04-01 | - |

### Tracker de Cumplimiento Legal

| Requisito Legal | Ley/Norma | Estado | Evidencia |
|----------------|-----------|--------|-----------|
| Protección de datos personales | Ley 1581 de 2012 | ⏳ | Política en desarrollo |
| Tratamiento de datos | Decreto 1377 de 2013 | ⏳ | RUA pendiente |
| Seguridad de la información | Ley 1273 de 2009 | ⏳ | Plan de seguridad pendiente |
| Comercio electrónico | Ley 527 de 1999 | ✅ | Términos existentes |
| Derechos del consumidor | Ley 1480 de 2011 | ✅ | Proceso de reclamaciones |

### Tracker de Participantes del Piloto

| ID | Nombre | Estado | Fecha Ingreso | Fecha Completación | Notas |
|----|--------|--------|---------------|-------------------|-------|
| P001 | | Pendiente | - | - | |
| P002 | | Pendiente | - | - | |
| P003 | | Pendiente | - | - | |
| ... | | | | | |

---

*Documento generado: 2025-01-12*
*Versión: 2.0*
*Branch: feature/multimodal-quote-extraction-v2*
