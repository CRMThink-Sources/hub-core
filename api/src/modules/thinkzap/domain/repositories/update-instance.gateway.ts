export interface UpdateInstanceGateway {
  update(id: string, name: string, token: string): Promise<void>
  subscribe(id: string, token: string): Promise<void>
  unsubscribe(id: string, token: string): Promise<void>
}
