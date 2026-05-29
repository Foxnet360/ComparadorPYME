import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Sanitiza contenido de notas consultivas
 * Convierte markdown a HTML seguro usando DOMPurify
 */
export function sanitizeNote(rawContent: string): string {
  // Primero convertir markdown a HTML
  const html = marked.parse(rawContent, { async: false }) as string;
  
  // Luego sanitizar con DOMPurify
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['href', 'title', 'target'],
  });
  
  return sanitized;
}

/**
 * Sanitiza contenido plano (sin HTML)
 * Útil para tooltips y previsualizaciones
 */
export function sanitizePlainText(rawContent: string): string {
  // Remover HTML
  const temp = document.createElement('div');
  temp.innerHTML = rawContent;
  return temp.textContent || temp.innerText || '';
}
