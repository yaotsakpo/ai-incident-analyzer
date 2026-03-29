import { Response } from 'express';
import { SSEEventType } from '@incident-analyzer/shared';

type SSEClient = {
  id: string;
  res: Response;
};

class EventEmitter {
  private clients: SSEClient[] = [];
  private clientIdCounter = 0;

  addClient(res: Response): string {
    const id = `client-${++this.clientIdCounter}`;
    this.clients.push({ id, res });

    res.on('close', () => {
      this.clients = this.clients.filter(c => c.id !== id);
    });

    return id;
  }

  removeClient(id: string): void {
    this.clients = this.clients.filter(c => c.id !== id);
  }

  emit(type: SSEEventType, data: any): void {
    const event = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) {
      try {
        client.res.write(payload);
      } catch {
        this.removeClient(client.id);
      }
    }
  }

  getClientCount(): number {
    return this.clients.length;
  }
}

export const sseEmitter = new EventEmitter();
