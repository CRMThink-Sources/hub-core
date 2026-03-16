export interface EventHandler<TEvent = unknown> {
  eventType: string;
  handle(event: TEvent): Promise<void>;
}

export class EventRegistry<T extends EventHandler> {
  private handlers = new Map<string, T>();

  register(handler: T): void {
    this.handlers.set(handler.eventType, handler);
  }

  get(eventType: string): T | undefined {
    return this.handlers.get(eventType);
  }
}
