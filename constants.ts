import pymeTaxonomy from './data/domains/pyme/taxonomy.json';

export const PLANTILLA_ITEMS = pymeTaxonomy.categories.map((c) => c.name);

export const DISCLAIMER_TEXT =
  'Advertencia Metodológica: Este análisis automatizado reduce el tiempo de comparación manual, aplicando principios de prevalencia técnica. Los elementos marcados como críticos requieren validación humana especializada. Esta herramienta potencia la asesoría profesional, no la sustituye.';
