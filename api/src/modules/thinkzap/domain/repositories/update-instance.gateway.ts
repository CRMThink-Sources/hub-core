export interface UpdateInstanceGateway {
  update(id: string, name: string, token: string): Promise<void>
}
