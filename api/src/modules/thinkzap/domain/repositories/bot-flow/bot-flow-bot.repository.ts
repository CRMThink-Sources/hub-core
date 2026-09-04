/** Bot de canal aberto de uma instalação. Um por app — ver `ThinkzapBotFlowBot`. */
export type BotFlowBot = {
  appId: string
  bitrixBotId: number
  /** `CLIENT_ID` de `bot.session.transfer` / `.finish`. */
  botToken: string
  webhookUrl: string
}

export interface GetBotFlowBotRepository {
  getByAppId(appId: string): Promise<BotFlowBot | null>
}

export interface SaveBotFlowBotRepository {
  /** Grava ou substitui o bot da instalação. */
  save(input: BotFlowBot): Promise<BotFlowBot>
}

export interface DeleteBotFlowBotRepository {
  delete(appId: string): Promise<void>
}
