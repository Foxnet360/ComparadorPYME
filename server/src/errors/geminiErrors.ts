import { AppError } from './appError';

export class GeminiError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    public errorCode: string,
    public userMessage: string,
    public retryAfter?: number
  ) {
    super(message, statusCode);
    this.name = 'GeminiError';
  }
}

export class GeminiRateLimitError extends GeminiError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(
      message,
      429,
      'GEMINI_RATE_LIMIT',
      'Límite de requests excedido. Espera 1 minuto y reintenta.',
      retryAfter
    );
    this.name = 'GeminiRateLimitError';
  }
}

export class GeminiServiceUnavailableError extends GeminiError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(
      message,
      503,
      'GEMINI_SERVICE_UNAVAILABLE',
      'Gemini temporalmente no disponible. Reintenta en unos momentos.'
    );
    this.name = 'GeminiServiceUnavailableError';
  }
}

export class GeminiTimeoutError extends GeminiError {
  constructor(message: string = 'Request timeout') {
    super(
      message,
      504,
      'GEMINI_TIMEOUT',
      'La extracción tomó demasiado tiempo. Intenta con un PDF más pequeño.'
    );
    this.name = 'GeminiTimeoutError';
  }
}

export class GeminiInvalidResponseError extends GeminiError {
  constructor(message: string = 'Invalid response from Gemini') {
    super(
      message,
      502,
      'GEMINI_INVALID_RESPONSE',
      'Respuesta inesperada de Gemini. Contacta soporte si persiste.'
    );
    this.name = 'GeminiInvalidResponseError';
  }
}

export class GeminiUnknownError extends GeminiError {
  constructor(message: string = 'Unknown Gemini error') {
    super(
      message,
      500,
      'GEMINI_UNKNOWN_ERROR',
      'Error interno del servicio de IA. Contacta soporte.'
    );
    this.name = 'GeminiUnknownError';
  }
}

interface GeminiErrorLike {
  message?: string;
  status?: number;
  statusCode?: number;
}

export function categorizeGeminiError(error: unknown): GeminiError {
  const err = error as GeminiErrorLike;
  const message = err?.message || '';
  const status = err?.status || err?.statusCode;

  if (
    status === 429 ||
    message.includes('429') ||
    message.includes('Quota exceeded') ||
    message.includes('Too Many Requests')
  ) {
    return new GeminiRateLimitError(message);
  }

  if (
    status === 503 ||
    message.includes('503') ||
    message.includes('Service Unavailable') ||
    message.includes('high demand')
  ) {
    return new GeminiServiceUnavailableError(message);
  }

  if (
    message.includes('timeout') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ECONNABORTED')
  ) {
    return new GeminiTimeoutError(message);
  }

  if (
    status === 502 ||
    message.includes('Invalid response') ||
    message.includes('Unexpected token')
  ) {
    return new GeminiInvalidResponseError(message);
  }

  return new GeminiUnknownError(message);
}
