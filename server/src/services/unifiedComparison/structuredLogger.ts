/**
 * Structured Logger for Unified Engine
 * Provides structured logging with correlation IDs for request tracing
 */

import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  correlationId: string;
  service: string;
  operation: string;
  message: string;
  metadata?: Record<string, unknown>;
  durationMs?: number;
  success?: boolean;
  error?: string;
}

export interface LoggerContext {
  correlationId: string;
  service: string;
  operation: string;
}

class StructuredLogger {
  private logDir: string;
  private minLevel: LogLevel;
  private shouldLogToConsole: boolean;
  private shouldLogToFile: boolean;

  constructor(options: {
    logDir?: string;
    minLevel?: LogLevel;
    logToConsole?: boolean;
    logToFile?: boolean;
  } = {}) {
    this.logDir = options.logDir || path.join(process.cwd(), 'logs');
    this.minLevel = options.minLevel || LogLevel.INFO;
    this.shouldLogToConsole = options.logToConsole !== false;
    this.shouldLogToFile = options.logToFile !== false;

    // Ensure log directory exists
    if (this.shouldLogToFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Create a logger context with correlation ID
   */
  createContext(operation: string, correlationId?: string): LoggerContext {
    return {
      correlationId: correlationId || this.generateCorrelationId(),
      service: 'unified-comparison-engine',
      operation
    };
  }

  /**
   * Generate a unique correlation ID
   */
  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Log a message
   */
  private log(entry: LogEntry): void {
    // Check minimum level
    if (!this.shouldLog(entry.level)) {
      return;
    }

    // Format log entry
    const formattedEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString()
    };

    // Log to console
    if (this.shouldLogToConsole) {
      this.writeToConsole(formattedEntry);
    }

    // Log to file
    if (this.shouldLogToFile) {
      this.writeToFile(formattedEntry);
    }
  }

  /**
   * Check if level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const minIndex = levels.indexOf(this.minLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= minIndex;
  }

  /**
   * Write to console
   */
  private writeToConsole(entry: LogEntry): void {
    const icon = this.getLevelIcon(entry.level);
    const correlationStr = `[${entry.correlationId}]`;
    const durationStr = entry.durationMs ? `(${entry.durationMs}ms)` : '';
    
    console.log(
      `${icon} ${correlationStr} ${entry.service}:${entry.operation} ${durationStr}`
    );
    console.log(`   ${entry.message}`);
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      console.log(`   Metadata:`, JSON.stringify(entry.metadata, null, 2));
    }
    
    if (entry.error) {
      console.error(`   Error: ${entry.error}`);
    }
  }

  /**
   * Get icon for log level
   */
  private getLevelIcon(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '🔍';
      case LogLevel.INFO: return 'ℹ️';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.ERROR: return '❌';
      default: return '📝';
    }
  }

  /**
   * Write to file
   */
  private writeToFile(entry: LogEntry): void {
    try {
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `unified-engine-${date}.log`);
      
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Log comparison start
   */
  logComparisonStart(context: LoggerContext, pdfCount: number, pdfPaths: string[]): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      correlationId: context.correlationId,
      service: context.service,
      operation: context.operation,
      message: `Starting comparison for ${pdfCount} quotes`,
      metadata: {
        pdfCount,
        pdfPaths: pdfPaths.map(p => path.basename(p))
      }
    });
  }

  /**
   * Log comparison completion
   */
  logComparisonComplete(context: LoggerContext, durationMs: number, confidence: number, success: boolean, error?: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      correlationId: context.correlationId,
      service: context.service,
      operation: context.operation,
      message: success ? 'Comparison completed successfully' : 'Comparison failed',
      durationMs,
      success,
      error,
      metadata: {
        confidence,
        durationMs
      }
    });
  }

  /**
   * Log engine selection
   */
  logEngineSelection(context: LoggerContext, engine: 'unified' | 'legacy' | 'fallback', reason?: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      correlationId: context.correlationId,
      service: context.service,
      operation: context.operation,
      message: `Engine selected: ${engine}`,
      metadata: {
        engine,
        reason
      }
    });
  }

  /**
   * Log fallback event
   */
  logFallback(context: LoggerContext, error: string, fallbackReason: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      correlationId: context.correlationId,
      service: context.service,
      operation: context.operation,
      message: `Fallback to legacy engine: ${fallbackReason}`,
      error,
      metadata: {
        fallbackReason,
        error
      }
    });
  }

  /**
   * Log PDF upload
   */
  logPdfUpload(context: LoggerContext, fileName: string, fileSize: number, success: boolean, error?: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      correlationId: context.correlationId,
      service: context.service,
      operation: context.operation,
      message: success ? `PDF uploaded: ${fileName}` : `PDF upload failed: ${fileName}`,
      success,
      error,
      metadata: {
        fileName,
        fileSize
      }
    });
  }

  /**
   * Log cache operation
   */
  logCacheOperation(context: LoggerContext, operation: 'hit' | 'miss' | 'set', fileHash: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      correlationId: context.correlationId,
      service: context.service,
      operation: context.operation,
      message: `Cache ${operation}: ${fileHash.substring(0, 8)}...`,
      metadata: {
        cacheOperation: operation,
        fileHash: fileHash.substring(0, 8)
      }
    });
  }

  /**
   * Log validation results
   */
  logValidation(context: LoggerContext, validations: number, discrepancies: number): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      correlationId: context.correlationId,
      service: context.service,
      operation: context.operation,
      message: `Validation complete: ${validations} validations, ${discrepancies} discrepancies`,
      metadata: {
        validations,
        discrepancies
      }
    });
  }

  /**
   * Log debug message
   */
  debug(context: LoggerContext, message: string, metadata?: Record<string, unknown>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      correlationId: context.correlationId,
      service: context.service,
      operation: context.operation,
      message,
      metadata
    });
  }

  /**
   * Log info message
   */
  info(context: LoggerContext, message: string, metadata?: Record<string, unknown>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      correlationId: context.correlationId,
      service: context.service,
      operation: context.operation,
      message,
      metadata
    });
  }

  /**
   * Log warning message
   */
  warn(context: LoggerContext, message: string, metadata?: Record<string, unknown>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      correlationId: context.correlationId,
      service: context.service,
      operation: context.operation,
      message,
      metadata
    });
  }

  /**
   * Log error message
   */
  error(context: LoggerContext, message: string, error?: string, metadata?: Record<string, unknown>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      correlationId: context.correlationId,
      service: context.service,
      operation: context.operation,
      message,
      error,
      metadata
    });
  }
}

export const structuredLogger = new StructuredLogger();
export default structuredLogger;