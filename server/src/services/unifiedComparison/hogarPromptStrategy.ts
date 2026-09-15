/**
 * Hogar Prompt Strategy
 * Dedicated extraction prompt strategy for residential home insurance quotes in Colombia
 * (Edificio, Contenido, Edificio + Contenido).
 */

import { FormatFamily } from '../formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';
import { PromptContext, PromptStrategy } from './promptStrategyFactory';

export const HOGAR_GRANULAR_SECTIONS = [
  {
    section: 'BIENES ASEGURADOS',
    rows: [
      'Edificio / Estructura',
      'Contenidos / Muebles y Enseres',
      'Contenidos Especiales (Joyas, Obras de Arte)',
      'Equipo Eléctrico y Electrónico',
    ],
  },
  {
    section: 'COBERTURAS',
    rows: [
      'Amparo básico (Incendio, Rayo, Explosión)',
      'Terremoto, Temblor y Erupción Volcánica',
      'Daños por Agua, Anegación e Inundación',
      'Granizo, Vientos Fuertes y Tempestades (Vendaval)',
      'Sustracción y Hurto Calificado dentro del Predio',
      'Responsabilidad Civil Extracontractual Hogar y Familiar (RCE)',
      'Gastos de Alojamiento Temporal / Pérdida de Arrendamiento',
      'Remoción de Escombros',
      'Asistencia Domiciliaria (Plomería, Cerrajería, Electricidad, Vidriería)',
      'Todo Riesgo Equipos Portátiles / Movilidad (Bicicletas/Patinetas)',
    ],
  },
  {
    section: 'DEDUCIBLES',
    rows: [
      'Deducible Terremoto',
      'Deducible Daños por Agua / Anegación',
      'Deducible Sustracción / Hurto',
      'Deducible Granizo / Vendaval',
      'Deducible RCE Hogar',
      'Deducible Equipo Eléctrico y Electrónico',
      'Deducible Asistencia Domiciliaria',
    ],
  },
  {
    section: 'FINANCIAL',
    rows: ['Prima con IVA incluido', 'Gastos de expedición', 'IVA', 'Total prima', 'Forma de pago'],
  },
] as const;

export class HogarPromptStrategy implements PromptStrategy {
  buildPromptForFamily(family: FormatFamily, context?: PromptContext): string {
    return `Eres un analista de seguros de Hogar y Vivienda en Colombia. Extrae con precisión los amparos de la cotización residencial, distinguiendo si cubre Edificio, Contenido o ambos.`;
  }

  buildTemplatePrompt(
    templateId: string,
    template: TemplateRegistryEntry,
    tables: LayoutTable[]
  ): string {
    return `Extrae las coberturas y deducibles de la cotización de Hogar según la plantilla ${templateId}.`;
  }

  buildCorrectionPrompt(originalResponse: string, errorMessage: string): string {
    return `Tu respuesta anterior no cumplió el esquema de cotización de hogar: ${errorMessage}. Corrige el JSON preservando montos de Edificio, Contenido, coberturas y deducibles.`;
  }

  getResponseSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        insurers: { type: 'array', items: { type: 'string' } },
        rows: { type: 'array' },
      },
      required: ['insurers', 'rows'],
    };
  }
}

export const hogarPromptStrategy = new HogarPromptStrategy();
