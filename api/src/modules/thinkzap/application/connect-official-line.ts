import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { apiLogger } from '@/shared/infra/logger'
import type { SyncLineConnectedField } from './sync-line-connected-field'
import { assertEnabledOfficialLineInContext } from './helpers/resolve-line-by-subscription-item'

export type ConnectOfficialLineInput = {
  /** Id do item de assinatura — a linha, do ponto de vista do cliente. */
  subscriptionItemId: string
  domainId: string
  appCode: string
  /** Os três vêm do SDK `@hubmessage/connect`, executado no iframe Bitrix. */
  wabaId: string
  phoneId: string
  code: string
}

export type ConnectOfficialLineResult = {
  wabaId: string
  /**
   * `false` quando o canal conectou no provider e a WABA não chegou ao item.
   *
   * Sai no resultado, e não só no log, porque é estado real que a tela precisa
   * dizer: a linha está conectada e os templates vão recusar até a WABA existir.
   */
  wabaRecorded: boolean
}

/**
 * Conclui a conexão do WhatsApp Oficial de uma linha e grava a WABA no item.
 *
 * A linha é endereçada pelo **item de assinatura**: o `channelId` sai do
 * `metadata` dele, e nem `Connector` nem `Instance` participam — linha
 * provisionada pela SPA não tem nenhum dos dois.
 *
 * A ordem dos passos, e ela importa:
 *
 * ```
 * 1. resolve o item no contexto     ← fora da instalação: não encontrado
 * 2. recusa provider ≠ HUBMESSAGE   ← antes da habilitação: item NONE nunca foi linha
 * 3. recusa linha bloqueada         ← antes da HubMessage: não gasta a autenticação Meta
 * 4. POST /v1/channels/{id}/connect ← falha aqui sobe: nada foi gravado
 * 5. grava metadata.wabaId no item  ← falha aqui NÃO derruba: ver `recordWaba`
 * 6. grava Conectado = Sim no item   ← falha aqui NÃO derruba: ver `recordConnected`
 * ```
 *
 * Os passos 2 e 3 estão em `assertEnabledOfficialLineInContext`, que é também a
 * porta da leitura do estado da conexão — as duas superfícies não podem discordar
 * sobre o que é uma linha oficial.
 */
export class ConnectOfficialLine {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly hubMessageClient: HubMessageClient,
    private readonly items: SubscriptionItemRepository,
    /**
     * Grava `UF_CRM_93_CONNECTED` sem esperar o webhook `CONNECTED`. Opcional: sem
     * ele, o campo fica só com o caminho do webhook.
     */
    private readonly syncConnected?: Pick<SyncLineConnectedField, 'execute'>,
  ) {}

  async execute(
    input: ConnectOfficialLineInput,
    now: Date = new Date(),
  ): Promise<ConnectOfficialLineResult> {
    /**
     * Falha de leitura do contexto **não** é capturada: sobe para o controller
     * virar `502`. Traduzir para "não encontrada" afirmaria que a linha não existe
     * quando só a leitura do Bitrix falhou.
     */
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    const line = assertEnabledOfficialLineInContext(
      context,
      input.subscriptionItemId,
      now,
    )

    await this.hubMessageClient.connectChannel(line.channelId, {
      wabaId: input.wabaId,
      phoneId: input.phoneId,
      code: input.code,
      coexistence: false,
    })

    const wabaRecorded = await this.recordWaba(line, input.wabaId)
    await this.recordConnected(line)

    return { wabaId: input.wabaId, wabaRecorded }
  }

  /**
   * Espelho para o CRM, não estado: **não lança**, pelo mesmo motivo de
   * `recordWaba` — o canal já conectou, e o webhook `CONNECTED` ainda grava o
   * campo se esta escrita se perder.
   */
  private async recordConnected(line: {
    channelId: string
    item: { id: string; connected?: boolean | null }
  }): Promise<void> {
    if (!this.syncConnected) return

    try {
      await this.syncConnected.execute({
        itemId: line.item.id,
        current: line.item.connected ?? null,
        connected: true,
      })
    } catch (error) {
      apiLogger.warn(
        {
          app: 'thinkzap',
          itemId: line.item.id,
          channelId: line.channelId,
          err: error,
        },
        'Canal conectado e o campo Conectado não foi gravado no item da linha',
      )
    }
  }

  /**
   * Grava a WABA no `metadata` do item — **é aqui que ela passa a existir para o
   * produto**. O provisionamento cria só o canal; a WABA nasce no embedded signup,
   * nesta requisição, e é dela que as operações de template leem.
   *
   * Só o `metadata`: `settings` e `vinculatedChannel` são configuração do cliente e
   * não têm nada a ver com conectar um número.
   *
   * **Não lança.** O canal já está conectado no provider neste ponto, e transformar
   * isso em erro faria o cliente ver falha sobre uma conexão que deu certo. O que se
   * perde é a WABA no item, e é isso que o `false` reporta.
   */
  private async recordWaba(
    line: { channelId: string; wabaId: string | null; item: { id: string } },
    wabaId: string,
  ): Promise<boolean> {
    // Mesma WABA já gravada: nada a escrever, e a linha está do jeito que deve.
    if (line.wabaId === wabaId) return true

    try {
      /**
       * O `metadata` vai inteiro, e não por spread do que veio do contexto: ele é
       * gravado como bloco na SPA, e os três campos do provider oficial estão todos
       * aqui — canal, WABA e o discriminante.
       */
      await this.items.updateSubscriptionItem(line.item.id, {
        metadata: {
          provider: 'HUBMESSAGE',
          hubmessageChannelId: line.channelId,
          wabaId,
        },
      })

      return true
    } catch (error) {
      apiLogger.error(
        {
          app: 'thinkzap',
          itemId: line.item.id,
          channelId: line.channelId,
          wabaId,
          err: error,
        },
        'Canal conectado e a WABA não foi gravada no item da linha — templates vão recusar até ela existir; gravar à mão no CRM',
      )

      return false
    }
  }
}
