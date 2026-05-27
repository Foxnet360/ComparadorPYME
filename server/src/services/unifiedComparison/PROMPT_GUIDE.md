# Prompt Structure and Customization Guide

## Overview

The Unified Comparison Engine uses a sophisticated prompt system designed for Gemini 3.5 Flash. The prompts are structured to extract maximum value from multimodal processing while maintaining consistency and reliability.

## Prompt Architecture

### Main Components

1. **System Role Definition**
2. **Context Setting**
3. **Task Description**
4. **Structured Extraction Instructions**
5. **Critical Rules**
6. **Output Format Specification**

---

## 1. Comparison Prompt

### Purpose
Main prompt for comparing multiple insurance quotes in a single LLM call.

### Structure

```
[ROLE DEFINITION]
Eres un analista experto en seguros comerciales...

[CONTEXT]
- N cotizaciones para el mismo riesgo
- Diferentes aseguradoras
- Nombres equivalentes posibles

[TASK]
Analiza TODAS las cotizaciones y genera JSON estructurado

[EXTRACTION SECTIONS]
1. Información General
2. Bienes Asegurados
3. Coberturas Principales
4. Deducibles
5. Primas y Costos

[RULES]
1. Identifica coberturas equivalentes
2. Marca como "N.C." las no contratadas
3. NO inventes datos
4. Extrae deducibles exactamente
...

[OUTPUT]
Responde ÚNICAMENTE con JSON
```

### Customization Points

#### Adding New Coverage Categories

To add a new coverage category, modify the extraction instructions:

```typescript
// In comparisonPromptBuilder.ts
buildComparisonPrompt(context: PromptContext): string {
  return `...existing prompt...

3. COBERTURAS PRINCIPALES:
   - ...existing coverages...
   - [NEW COVERAGE NAME]
   
   ...`;
}
```

#### Modifying Extraction Rules

Rules can be customized by adding or removing items:

```typescript
// Add custom rule
REGLAS CRÍTICAS:
1. ...existing rules...
8. [NEW RULE: Custom validation requirement]
```

#### Changing Output Language

The prompt is currently in Spanish. To change to English:

```typescript
buildComparisonPrompt(context: PromptContext): string {
  return `You are an expert commercial insurance analyst...

CONTEXT:
- You are analyzing ${context.insurerCount} quotes...

...`;
}
```

---

## 2. Correction Prompt

### Purpose
Triggered when the initial response has JSON parsing errors or schema validation failures.

### When It's Used
- JSON parse error
- Missing required fields
- Invalid data types
- Schema validation failure

### Structure

```
ERROR: [Specific error message]

PREVIOUS RESPONSE (partial):
[First 1000 chars of invalid response]

CORRECTION INSTRUCTIONS:
1. All required fields must be present
2. Arrays must have correct structure
3. null values must be explicit
4. No additional fields outside schema
```

### Customization

#### Retry Count

Default: 2 retries

To change:
```typescript
// In unifiedComparisonEngine.ts
const DEFAULT_CONFIG: ComparisonEngineConfig = {
  maxRetries: 3, // Change this value
  retryDelayMs: 5000
};
```

#### Correction Prompt Content

Modify in `comparisonPromptBuilder.ts`:

```typescript
buildCorrectionPrompt(originalResponse: string, errorMessage: string): string {
  return `Your previous response had a format error.

ERROR: ${errorMessage}

Please generate a valid JSON following the schema exactly.
[Custom additional instructions...]`;
}
```

---

## 3. Deep Mode Prompt

### Purpose
Validates comparison results against official clause documents (clausulados).

### When It's Used
- User uploads clause PDFs
- Deep mode endpoint is called
- Ambiguous deductibles need resolution

### Structure

```
ROLE: Expert in insurance clauses

INPUT:
- Current comparison (JSON)
- Clause documents (PDF attachments)

TASKS:
1. Resolve ambiguous deductibles
2. Verify coverage inclusion
3. Identify exclusions
4. Detect discrepancies
5. Extract sub-limits

OUTPUT: Validation JSON
```

### Customization

#### Adding Validation Rules

```typescript
buildDeepModePrompt(comparisonJson: string): string {
  return `...

VALIDATION TASKS:
1. ...existing tasks...
6. [NEW TASK: Check specific clause requirement]

...`;
}
```

---

## Prompt Engineering Best Practices

### 1. Role Definition
- **Be specific**: "Expert in commercial insurance" vs "Analyst"
- **Include context**: "Colombian market", "PYME segment"
- **Set expertise level**: "10+ years experience"

### 2. Context Setting
- **Quote count**: Dynamic based on input
- **Market context**: Colombian insurance regulations
- **Document types**: PDF quotes

### 3. Task Clarity
- **One main task**: "Generate structured comparison"
- **Sub-tasks numbered**: Clear extraction sections
- **Output format**: Explicit JSON requirement

### 4. Rules Format
- **Numbered list**: Easy to reference
- **Critical first**: Most important rules first
- **Examples**: "N.C. for not contracted"

### 5. Output Specification
- **"ÚNICAMENTE"**: Forces JSON-only response
- **No explanations**: Reduces hallucination
- **Schema reference**: Links to JSON Schema

---

## Configuration Options

### Thinking Level

Controls reasoning depth:

```typescript
// In comparisonSchema.ts or engine config
const config = {
  thinkingConfig: {
    thinkingLevel: 'MEDIUM' // Options: LOW, MEDIUM, HIGH
  }
};
```

- **LOW**: Fastest, basic extraction
- **MEDIUM**: Balanced (default)
- **HIGH**: Most thorough, slower

### Response Schema

The structured output schema is defined in `comparisonSchema.ts`. To modify:

```typescript
export const UnifiedComparisonSchema = {
  // Add new field
  properties: {
    // ...existing fields...
    newField: { type: SchemaType.STRING }
  }
};
```

---

## Testing Prompts

### Unit Testing

```typescript
// Test prompt generation
const prompt = comparisonPromptBuilder.buildComparisonPrompt({
  insurerCount: 4
});

expect(prompt).toContain('4 cotizaciones');
expect(prompt).toContain('JSON');
```

### Integration Testing

```typescript
// Test with real PDFs
const result = await unifiedComparisonEngine.compare(pdfPaths);
expect(result.metadata.confidence).toBeGreaterThan(0.5);
```

### A/B Testing Prompts

To test different prompt versions:

```typescript
// Version A
const promptA = comparisonPromptBuilder.buildComparisonPrompt({...});

// Version B (with modifications)
const promptB = comparisonPromptBuilder.buildComparisonPromptV2({...});

// Compare results
const resultA = await engine.compareWithPrompt(promptA, pdfs);
const resultB = await engine.compareWithPrompt(promptB, pdfs);
```

---

## Common Customizations

### Adding Industry-Specific Rules

```typescript
// For specific industries
buildComparisonPrompt(context: PromptContext, industry?: string): string {
  let prompt = `...base prompt...`;
  
  if (industry === 'restaurantes') {
    prompt += `
REGLAS ESPECÍFICAS RESTAURANTES:
- Prioriza cobertura de Daños por Agua
- Verificar cobertura de Congelación
- Revisar RCE Alimentos específicamente`;
  }
  
  return prompt;
}
```

### Multi-Language Support

```typescript
// Language-specific prompts
buildComparisonPrompt(context: PromptContext, language: 'es' | 'en' = 'es'): string {
  if (language === 'en') {
    return `You are an expert...`;
  }
  return `Eres un analista experto...`;
}
```

### Custom Coverage Categories

```typescript
// For specific insurance types
buildComparisonPrompt(context: PromptContext, insuranceType: string): string {
  const basePrompt = `...`;
  
  const coverageSections = {
    'pyme': [...standardCoverages...],
    'constructor': [...constructionCoverages...],
    'transporte': [...transportCoverages...]
  };
  
  return basePrompt.replace(
    '[COVERAGE_SECTIONS]',
    coverageSections[insuranceType].join('\n')
  );
}
```

---

## Performance Optimization

### Reducing Token Usage

1. **Remove unnecessary whitespace**
2. **Use abbreviations in schema**
3. **Minimize examples**

### Improving Accuracy

1. **Add specific examples**
2. **Include edge cases in rules**
3. **Use explicit formatting instructions**

### Reducing Latency

1. **Use LOW thinking level for simple comparisons**
2. **Cache prompts**
3. **Pre-process PDFs to extract text**

---

## Troubleshooting Prompt Issues

### Issue: Hallucinated Data

**Solution**: Add explicit rule:
```
REGLA: NO inventes datos. Si no encuentras algo, usa null o "No informado"
```

### Issue: Inconsistent Formatting

**Solution**: Add explicit formatting rules:
```
REGLA: Extrae los deducibles EXACTAMENTE como aparecen en el documento
```

### Issue: Missing Coverages

**Solution**: Add completeness check:
```
REGLA: Verifica que TODAS las coberturas del documento estén incluidas
```

### Issue: Wrong Language

**Solution**: Set explicit language context:
```
CONTEXTO: Estás analizando cotizaciones en español para el mercado colombiano
```

---

## Related Documentation

- [JSON Schema Documentation](./JSON_SCHEMA.md)
- [Comparison Engine Configuration](../config/featureFlags.ts)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)