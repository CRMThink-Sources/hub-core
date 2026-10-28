import type { SubscribeOutcome } from '../ports/whatsapp-connector-provider.port'

export interface UpdateInstanceGateway {
  update(id: string, name: string, token: string): Promise<void>
  subscribe(id: string, token: string): Promise<SubscribeOutcome>
  unsubscribe(id: string, token: string): Promise<void>
}
