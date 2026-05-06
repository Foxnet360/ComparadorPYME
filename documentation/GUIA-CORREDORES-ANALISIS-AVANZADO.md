# Guía para Corredores: Cómo Interpretar el Análisis Avanzado

## Introducción

El **Análisis Avanzado** es una nueva capacidad que valida automáticamente las cotizaciones contra los clausulados oficiales de cada aseguradora. Esta guía te ayuda a interpretar cada sección para tomar mejores decisiones.

---

## 1. Validación de Coberturas

### Qué hace
Compara las coberturas ofrecidas en la cotización contra el clausulado oficial de la aseguradora.

### Métricas clave

| Métrica | Significado | Acción recomendada |
|---------|-------------|-------------------|
| **Verificadas** | Coberturas que existen en el clausulado | Buena señal - están respaldadas |
| **Fantasma** | Coberturas ofrecidas pero NO en el clausulado | **CRÍTICO** - Puede ser oferta comercial no contractual |
| **Oblig. Omitidas** | Coberturas obligatorias del clausulado que faltan en la cotización | **CRÍTICO** - El cliente no está cubierto |
| **Opc. Omitidas** | Coberturas opcionales que faltan | Revisar si el cliente las necesita |

### Ejemplo práctico

```
Verificadas: 12/14 ✓
Fantasma: 1 ⚠️
Oblig. Omitidas: 0 ✓
```

**Interpretación:** 12 coberturas están en el clausulado (bien), pero hay 1 cobertura "fantasma" - probablemente una promoción comercial. Verificar con la aseguradora si es un beneficio real o solo marketing.

---

## 2. Riesgo de Deducibles

### Qué hace
Analiza si los deducibles son apropiados para el tipo de negocio y suma asegurada.

### Niveles de riesgo

- **LOW (Bajo)** 🟢: Deducible razonable. El cliente puede absorber el costo.
- **MEDIUM (Medio)** 🟡: Deducible alto. Considerar impacto en caso de siniestro.
- **HIGH (Alto)** 🔴: Deducible muy alto o sin tope. Riesgo financiero significativo.

### Ejemplo práctico

```
Incendio: 10% del valor asegurado → Riesgo: MEDIUM
```

**Interpretación:** En un edificio de $500M, el deducible sería $50M. Para una PYME, esto podría ser difícil de cubrir. Considerar negociar un deducible con tope máximo (ej: 10% con máximo de 10 SMMLV).

---

## 3. Riesgo Contextualizado

### Qué hace
Cruza las exclusiones del clausulado con el perfil específico del cliente (tipo de negocio, ubicación, etc.).

### Niveles de riesgo

- **CRITICAL** 🔴: Exclusión que afecta directamente al cliente
- **WARNING** 🟡: Exclusión que podría afectar en ciertas circunstancias
- **INFO** 🔵: Exclusión estándar, bajo riesgo para este cliente

### Ejemplo práctico

**Cliente:** Fábrica en zona costera de Cartagena  
**Exclusión:** "No cubre daños por inundación en zonas costeras"  
**Riesgo:** CRITICAL

**Interpretación:** Esta exclusión es peligrosa para este cliente específico. Recomendar:
1. Negociar eliminación de la exclusión (difícil)
2. Contratar cobertura adicional de inundación
3. Considerar otra aseguradora sin esta exclusión

---

## 4. Cumplimiento de Garantías

### Qué hace
Analiza las condiciones especiales (garantías) que debe cumplir el cliente para mantener la vigencia.

### Estados

- **Compliant** 🟢: El cliente cumple todas las condiciones
- **At Risk** 🟡: El cliente cumple algunas, pero hay riesgo de incumplimiento
- **Non-compliant** 🔴: El cliente no cumple condiciones críticas

### Tipos de condiciones

| Tipo | Ejemplo | Dificultad |
|------|---------|------------|
| **Operacional** | "Mantener alarma 24/7" | Media |
| **Documental** | "Presentar facturas cada 6 meses" | Baja |
| **Técnica** | "Instalar extintores certificados" | Media |
| **Financiera** | "Fianza del 20%" | Alta |

### Ejemplo práctico

```
Total condiciones: 5
Compliant: 4/5
Riesgo: At Risk
```

**Interpretación:** El cliente cumple 4 de 5 condiciones. La condición faltante es "Fianza del 20%" (tipo financiera). Si no puede pagarla, la póliza quedaría sin efecto. Negociar con la aseguradora o buscar alternativas.

---

## 5. Asesoría Legal

### Qué hace
Genera un análisis legal personalizado combinando la cotización, el clausulado y el perfil del cliente.

### Componentes

**Opinión Legal:**
- Análisis de coberturas críticas para el tipo de negocio
- Identificación de lagunas legales
- Recomendaciones específicas

**Puntos de Negociación:**
- Sugerencias concretas para negociar con la aseguradora
- Priorizadas por impacto (HIGH/MEDIUM/LOW)
- Basadas en el clausulado oficial

### Ejemplo práctico

**Opinión:** "El límite de RC de $100M puede ser insuficiente para un manufacturero con 150 empleados. Jurisprudencia reciente sugiere límites mínimos de $200M para este perfil."

**Punto de negociación (HIGH):** "Solicitar aumento de límite RC a $200M o contratar RC Exceso."

**Punto de negociación (MEDIUM):** "Negociar eliminación de exclusión de terremoto dado que la planta está en zona sísmica."

---

## Checklist de Decisión

Antes de recomendar una cotización, verificar:

### Coberturas
- [ ] Todas las coberturas obligatorias están presentes
- [ ] No hay coberturas "fantasma" no respaldadas
- [ ] Los valores asegurados son adecuados

### Deducibles
- [ ] Los deducibles son razonables para el cliente
- [ ] Hay topes máximos donde sea posible
- [ ] El cliente entiende el impacto financiero

### Exclusiones
- [ ] Revisar exclusiones críticas para el perfil del cliente
- [ ] Identificar riesgos no cubiertos
- [ ] Proponer coberturas adicionales si es necesario

### Garantías
- [ ] El cliente puede cumplir todas las condiciones
- [ ] Las condiciones son razonables para su operación
- [ ] Hay plan de contingencia para condiciones difíciles

### Legal
- [ ] Límites de responsabilidad son adecuados
- [ ] No hay lagunas legales identificadas
- [ ] Se han identificado puntos de negociación

---

## FAQs

### ¿El Análisis Avanzado reemplaza mi juicio profesional?

**No.** Es una herramienta de apoyo. Siempre debes usar tu experiencia y conocimiento del cliente para la decisión final.

### ¿Qué pasa si no hay clausulado para una aseguradora?

El sistema marcará "Sin clausulado disponible" y usará coberturas esperadas estándar. Recomendar subir el clausulado al sistema para análisis más preciso.

### ¿Los puntos de negociación son garantizados?

No. Son sugerencias basadas en análisis del clausulado. La aseguradora puede o no aceptarlos.

### ¿Puedo confiar ciegamente en el análisis de IA?

**No.** El análisis tiene limitaciones:
- Puede no detectar todos los matices legales
- Depende de la calidad del clausulado subido
- No reemplaza asesoría legal profesional para casos complejos

Siempre verifica los puntos críticos manualmente.

---

## Soporte

Si encuentras inconsistencias o tienes dudas sobre el análisis:

1. Verificar que el clausulado subido sea la versión más reciente
2. Revisar que el perfil del cliente sea correcto
3. Contactar al equipo técnico para reportar discrepancias
