/** Bot de canal aberto de um fluxo — ver `ThinkzapBotFlowBot`. */
export type BotFlowBot = {
  appId: string
  /** `null` quando o fluxo foi apagado e o portal recusou o `unregister`. */
  flowId: string | null
  bitrixBotId: number
  /** `CLIENT_ID` de `bot.session.transfer` / `.finish`. */
  botToken: string
  webhookUrl: string
}

export interface GetBotFlowBotRepository {
  getByFlowId(appId: string, flowId: string): Promise<BotFlowBot | null>
}

export interface GetBotFlowBotByBitrixIdRepository {
  getByBitrixBotId(appId: string, bitrixBotId: number): Promise<BotFlowBot | null>
}

export interface ListBotFlowBotsRepository {
  listByAppId(appId: string): Promise<BotFlowBot[]>
}

export interface SaveBotFlowBotRepository {
  save(input: BotFlowBot & { flowId: string }): Promise<BotFlowBot>
}

export interface DeleteBotFlowBotRepository {
  delete(appId: string, bitrixBotId: number): Promise<void>
}
