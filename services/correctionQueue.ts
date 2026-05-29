import { CorrectionInput } from '../schemas/correction';

interface QueuedCorrection {
  id: string;
  correction: CorrectionInput;
  attempts: number;
  lastAttempt: number;
  status: 'pending' | 'syncing' | 'error';
  error?: string;
}

const QUEUE_KEY = 'correction_queue';
const MAX_ATTEMPTS = 3;

/**
 * Servicio de cola offline para correcciones
 * Almacena correcciones en localStorage cuando no hay conexión
 */
export class CorrectionQueue {
  private static getQueue(): QueuedCorrection[] {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private static saveQueue(queue: QueuedCorrection[]): void {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  static add(correction: CorrectionInput): string {
    const queue = this.getQueue();
    const id = `${correction.insurerName}::${correction.rawName}::${Date.now()}`;
    
    queue.push({
      id,
      correction,
      attempts: 0,
      lastAttempt: Date.now(),
      status: 'pending',
    });
    
    this.saveQueue(queue);
    return id;
  }

  static getPending(): QueuedCorrection[] {
    return this.getQueue().filter(item => item.status === 'pending' || item.status === 'error');
  }

  static getAll(): QueuedCorrection[] {
    return this.getQueue();
  }

  static remove(id: string): void {
    const queue = this.getQueue().filter(item => item.id !== id);
    this.saveQueue(queue);
  }

  static updateStatus(id: string, status: QueuedCorrection['status'], error?: string): void {
    const queue = this.getQueue().map(item => {
      if (item.id === id) {
        return { ...item, status, error, lastAttempt: Date.now() };
      }
      return item;
    });
    this.saveQueue(queue);
  }

  static incrementAttempt(id: string): void {
    const queue = this.getQueue().map(item => {
      if (item.id === id) {
        return { ...item, attempts: item.attempts + 1, lastAttempt: Date.now() };
      }
      return item;
    });
    this.saveQueue(queue);
  }

  static isMaxAttemptsReached(id: string): boolean {
    const item = this.getQueue().find(q => q.id === id);
    return item ? item.attempts >= MAX_ATTEMPTS : false;
  }

  static clear(): void {
    localStorage.removeItem(QUEUE_KEY);
  }

  static getCount(): number {
    return this.getPending().length;
  }

  /**
   * Sincroniza las correcciones pendientes con el servidor
   * @returns Resultados de la sincronización
   */
  static async sync(): Promise<{ success: string[]; failed: string[] }> {
    const pending = this.getPending();
    const success: string[] = [];
    const failed: string[] = [];

    for (const item of pending) {
      if (this.isMaxAttemptsReached(item.id)) {
        this.updateStatus(item.id, 'error', 'Máximo de intentos alcanzado');
        failed.push(item.id);
        continue;
      }

      try {
        this.updateStatus(item.id, 'syncing');
        this.incrementAttempt(item.id);

        const response = await fetch('/api/analysis/correction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.correction),
        });

        if (response.ok) {
          this.remove(item.id);
          success.push(item.id);
        } else {
          const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
          this.updateStatus(item.id, 'error', errorData.error);
          failed.push(item.id);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error de red';
        this.updateStatus(item.id, 'error', errorMessage);
        failed.push(item.id);
      }
    }

    return { success, failed };
  }
}

/**
 * Hook para usar la cola de correcciones
 */
export function useCorrectionQueue() {
  return {
    add: CorrectionQueue.add.bind(CorrectionQueue),
    getPending: CorrectionQueue.getPending.bind(CorrectionQueue),
    getCount: CorrectionQueue.getCount.bind(CorrectionQueue),
    sync: CorrectionQueue.sync.bind(CorrectionQueue),
    clear: CorrectionQueue.clear.bind(CorrectionQueue),
  };
}
