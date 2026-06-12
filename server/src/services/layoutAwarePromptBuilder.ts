import {
  TemplateRegistryEntry,
  LayoutTable,
  LayoutCell,
} from '../schemas/templateRegistrySchema';

/**
 * Build a layout-aware extraction prompt for a known insurer template.
 *
 * The prompt combines:
 * - The insurer/template identification and strict JSON schema.
 * - A markdown rendering of the reconstructed tables (rows/columns).
 * - Template-specific extraction hints and the prompt addon.
 * - Standard guardrails to prevent invented values.
 */
export function buildTemplatePrompt(
  templateId: string,
  template: TemplateRegistryEntry,
  tables: LayoutTable[]
): string {
  const schemaBlock = JSON.stringify(template.schema, null, 2);
  const hintsBlock = JSON.stringify(template.extractionHints, null, 2);
  const tablesBlock = renderTables(tables);

  return `Eres un extractor experto de cotizaciones de seguros PYME colombianos.

ESTE DOCUMENTO CORRESPONDE A LA PLANTILLA ASEGURADORA: ${templateId} (${template.insurer} - ${template.displayName})

INSTRUCCIONES ESPECÍFICAS DE LA PLANTILLA:
${template.promptAddon || 'No hay instrucciones adicionales.'}

HITS DE EXTRACCIÓN (páginas y columnas relevantes):
\`\`\`json
${hintsBlock}
\`\`\`

TABLAS RECONSTRUIDAS DESDE EL PDF (extrae los valores siguiendo estas columnas):
${tablesBlock}

ESQUEMA JSON OBLIGATORIO PARA LA RESPUESTA — rellena exactamente estos campos:
\`\`\`json
${schemaBlock}
\`\`\`

REGLAS CRÍTICAS:
1. Usa las tablas reconstruidas arriba como fuente principal de datos.
2. Si una celda está vacía o no se pudo reconstruir, usa null o un string vacío según el schema.
3. NO inventes coberturas, valores ni deducibles que no aparezcan en el documento.
4. Los deducibles deben extraerse de la columna indicada en extractionHints cuando exista.
5. Devuelve SOLO el JSON válido, sin texto adicional.`;
}

function renderCell(cell: LayoutCell | undefined): string {
  if (!cell) return '';
  return cell.text.replace(/\|/g, '\\|').trim();
}

function renderTables(tables: LayoutTable[]): string {
  if (tables.length === 0) {
    return 'No se pudieron reconstruir tablas. Usa la visión del documento como respaldo.';
  }

  return tables
    .map((table, index) => {
      const headerTexts = table.headers.map((h) => renderCell(h));
      const separator = headerTexts.map(() => '---').join(' | ');
      const headerLine = headerTexts.length > 0 ? `| ${headerTexts.join(' | ')} |` : '';
      const rows = table.rows
        .map((row) => {
          const cells = row.map((cell) => renderCell(cell));
          return `| ${cells.join(' | ')} |`;
        })
        .join('\n');

      const merged =
        table.mergedCells && table.mergedCells.length > 0
          ? `\nCeldas combinadas detectadas: ${table.mergedCells
              .map((c) => `"${renderCell(c)}"`)
              .join(', ')}`
          : '';

      return [
        `### Tabla ${index + 1} (página ${table.page})`,
        headerLine,
        separator,
        rows,
        merged,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

export default buildTemplatePrompt;
