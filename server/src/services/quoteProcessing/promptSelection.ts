/**
 * Prompt Selection Module
 * Determines whether to select a layout-aware template prompt or a family-based generic prompt.
 */

import { FormatDetectionResult } from '../formatDetector';
import { TemplateRegistryEntry } from '../../schemas/templateRegistrySchema';
import { LayoutParserResult } from '../layoutParser';
import { buildPromptForFamily, buildTemplatePrompt } from '../promptBuilder';
import {
  createStructuredLogger,
  globalMetrics,
} from '../../utils/structuredLogger';
import { ExtractionPromptContext, ExtractionPromptSelection } from './types';

/**
 * Select the appropriate extraction prompt based on format detection and template matching.
 */
export function selectExtractionPrompt(
  detection: FormatDetectionResult,
  template: TemplateRegistryEntry | undefined,
  layoutResult: LayoutParserResult,
  context: ExtractionPromptContext
): ExtractionPromptSelection {
  const logger = context.logger ?? createStructuredLogger('quoteProcessingService');
  const metrics = context.metrics ?? globalMetrics;
  const pageCount = context.pageCount;

  const templateMatches =
    detection.templateId && template && !layoutResult.failed && layoutResult.tables.length > 0;

  if (templateMatches) {
    const prompt = buildTemplatePrompt(
      detection.templateId!,
      template,
      layoutResult.tables,
      context.domain ?? 'pyme'
    );
    logger.info('pipeline_path_taken', 'Selected template-aware extraction prompt', {
      path: 'template',
      templateId: detection.templateId,
      insurer: template.insurer,
      tableCount: layoutResult.tables.length,
    });
    metrics.increment('quoteProcessing.pipeline_path', { path: 'template' });
    return { prompt, usedTemplate: true, templateId: detection.templateId };
  }

  const fallbackReason = !detection.templateId
    ? 'no template matched'
    : layoutResult.failed
      ? `layout parsing failed: ${layoutResult.failureReason}`
      : 'template matched but no usable tables';

  const prompt = buildPromptForFamily(detection.family, {
    pageCount,
    hasTables: detection.hasTables,
    formatFamily: detection.family,
    domain: context.domain ?? 'pyme',
  });

  logger.info('pipeline_path_taken', 'Selected generic extraction prompt', {
    path: 'generic',
    family: detection.family,
    fallbackReason,
    templateId: detection.templateId ?? undefined,
  });
  metrics.increment('quoteProcessing.pipeline_path', { path: 'generic' });

  return { prompt, usedTemplate: false, templateId: null };
}
