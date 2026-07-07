import { z } from 'zod';

/**
 * Schema Zod para validación de notas consultivas
 */
export const NoteSchema = z.object({
  cellId: z.string().min(1, 'El ID de celda es requerido'),
  content: z
    .string()
    .min(1, 'El contenido es requerido')
    .max(2000, 'La nota no puede exceder 2000 caracteres'),
  timestamp: z.number().int().positive(),
});

export type NoteInput = z.infer<typeof NoteSchema>;

/**
 * Schema para validación de contenido de nota (solo el texto)
 */
export const NoteContentSchema = z
  .string()
  .min(1, 'El contenido es requerido')
  .max(2000, 'La nota no puede exceder 2000 caracteres')
  .refine(
    (val) => {
      // Validación básica de seguridad: no permitir script tags
      const lower = val.toLowerCase();
      return (
        !lower.includes('<script') &&
        !lower.includes('javascript:') &&
        !lower.includes('onerror=') &&
        !lower.includes('onload=')
      );
    },
    {
      message: 'El contenido contiene elementos no permitidos por seguridad',
    }
  );

export type NoteContent = z.infer<typeof NoteContentSchema>;
