import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import {
  BitrixWebhookContext,
  GetBitrixWebhookContextRepository,
} from '@/modules/thinkzap/domain/repositories/get-bitrix-webhook-context.repository'
import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { ensureLineInstance } from '@/modules/thinkzap/application/helpers/ensure-line-instance'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import { prisma } from '@/config/prisma.js'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Resolve o contexto do caminho Bitrix → WhatsApp: a mensagem chega de um canal
 * aberto e é preciso saber qual linha responde.
 *
 * ```
 * domainName ──prisma──> Domain + App + Credential        (credencial da instalação)
 *      └──> GetAplicationContext ──> item com vinculatedChannel === line
 *                └──> Instance (só como âncora de FK de mensagem/conversa)
 * ```
 *
 * **A busca é pelo item, não pela row.** Antes era
 * `where: { vinculatedChannel: line }` em `core_thinkerszap_instances`, com o
 * vínculo espelhado na tabela. Espelho significa dois lugares que podem divergir:
 * editar `ufCrm93Conector` direto no CRM deixava o item dizendo um canal e a row
 * outro, e a mensagem roteava pelo antigo. Com a resolução pelo item, a classe de
 * bug desaparece.
 *
 * `Domain`, `App` e `Credential` continuam no Prisma — é credencial de instalação,
 * não configuração de linha.
 *
 * Dependências injetadas de propósito: a primeira tentativa construiu a árvore de
 * casos de uso aqui dentro e transformou uma query em algo que arrastava Prisma,
 * Redis e Bitrix. Recebendo de fora, o consumidor decide e o teste substitui.
 */
export class PrismaBitrixWebhookContextRepository implements GetBitrixWebhookContextRepository {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly instances: GetInstanceRepository &
      CreateInstanceRepository,
  ) {}

  async getContext(params: {
    domainName: string
    appCode: string
    line: string
  }): Promise<BitrixWebhookContext | null> {
    const domain = await prisma.domain.findFirst({
      where: { name: params.domainName },
      include: {
        apps: {
          where: { appCodeId: params.appCode },
          include: { credential: true },
          take: 1,
        },
      },
    })
    if (!domain) return null

    const app = domain.apps[0]
    if (!app) {
      throw new Error('App not found')
    }

    /**
     * Sem credencial utilizável não há como falar com o Bitrix do cliente. Antes
     * isso passava batido porque a tipagem do `include` era `any`: `accessToken` é
     * nullable no banco mas `Credential` o exige, e o consumidor só descobriria ao
     * tentar usar o token — com falha vaga, longe da causa.
     */
    if (!app.credential?.accessToken) {
      throw new Error(`App "${app.id}" sem credencial utilizável do Bitrix`)
    }
    const credential = {
      ...app.credential,
      accessToken: app.credential.accessToken,
    }

    const context = await this.getAplicationContext.execute({
      domainId: domain.id,
      appCode: params.appCode,
    })

    const item = findItemByChannel(context.subscriptions, params.line)
    if (!item) {
      apiLogger.warn(
        { app: 'thinkzap', line: params.line, domain: params.domainName },
        'Nenhum item de assinatura vinculado a este canal aberto',
      )
      return null
    }

    /**
     * A âncora existe porque mensagem e conversa têm chave estrangeira para
     * `Instance.id`. Criada quando falta — é o que faz linha nascida na SPA
     * conseguir persistir mensagem. Ver `ensureLineInstance`.
     */
    const instance = await this.resolveAnchor(item, domain.id)
    if (!instance) return null

    warnOnCredentialDrift(item, instance)

    return {
      id: domain.id,
      name: domain.name,
      memberId: domain.memberId,
      app: {
        id: app.id,
        domainId: app.domainId,
        appCodeId: app.appCodeId,
        status: app.status,
        credential,
      },
      // Do item, não de `Connector.provider`: é o item que declara o conector.
      connector: { provider: item.metadata.provider as ConnectorProvider },
      instance: {
        /**
         * Credencial **do item**, não da row.
         *
         * `ensureLineInstance` copia a credencial só no momento em que cria a âncora e
         * devolve `existing` sem reconciliar. Linha reprovisionada — instância nova,
         * token novo no item — deixava a row com a credencial velha, e este era o
         * único caminho de envio que ainda lia dela: o widget resolve pelo item a cada
         * execução (`resolveLineTarget`). O sintoma era envio aceito pela Z-API pelo
         * par antigo e mensagem que não chega, com o widget funcionando ao lado.
         *
         * A row continua sendo âncora de identidade — `instance.id` abaixo é a FK de
         * mensagem e conversa, e só ela vem de lá.
         */
        ...credentialFromItem(item),
        id: instance.id,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
        /**
         * Do item, que é a fonte. A coluna homônima da row deixou de ser escrita
         * quando o vínculo passou para `ufCrm93Conector` — ler dela devolveria o
         * canal antigo.
         */
        vinculatedChannel: item.vinculatedChannel,
        domainId: instance.domainId,
        status: instance.status,
        settings: item.settings,
      },
    }
  }

  /**
   * Z-API cria a âncora quando falta; HubMessage só busca.
   *
   * A assimetria é o provisionamento: uma linha Z-API é inteiramente descrita pela
   * credencial do item, então a row pode ser derivada dela. HubMessage guarda
   * `wabaId` e `phoneId` que só o fluxo de conexão conhece — inventar a row aqui
   * criaria registro incompleto.
   */
  private async resolveAnchor(item: SubscriptionItem, domainId: string) {
    if (item.metadata.provider === 'ZAPI') {
      return ensureLineInstance(item, domainId, this.instances)
    }

    if (item.metadata.provider === 'HUBMESSAGE') {
      const found = await this.instances.getInstanceByChannelId(
        item.metadata.hubmessageChannelId,
      )
      if (!found) {
        apiLogger.warn(
          { app: 'thinkzap', channelId: item.metadata.hubmessageChannelId },
          'Linha HubMessage sem registro de instância — mensagem não processada',
        )
      }
      return found
    }

    return null
  }
}

/**
 * A identidade da linha no provider, **do item da SPA**.
 *
 * Z-API é instância + token; HubMessage é o canal, que serve nas duas colunas — a
 * âncora grava o `channelId` também em `instance_id`, e o resolver de envio aceita os
 * dois. `NONE` não chega aqui: `resolveAnchor` já devolveu `null`.
 */
function credentialFromItem(item: SubscriptionItem): {
  instanceId: string
  zApiToken: string | null
  channelId: string | null
} {
  if (item.metadata.provider === 'HUBMESSAGE') {
    return {
      instanceId: item.metadata.hubmessageChannelId,
      zApiToken: null,
      channelId: item.metadata.hubmessageChannelId,
    }
  }

  if (item.metadata.provider === 'ZAPI') {
    return {
      instanceId: item.metadata.zApiInstanceId,
      zApiToken: item.metadata.zApiInstanceToken,
      channelId: null,
    }
  }

  throw new LineProviderNotSupportedError(item.metadata.provider)
}

/**
 * Registra quando a row divergiu do item.
 *
 * Não corrige e não falha: a partir daqui nada de comportamento lê a credencial da
 * row, então divergência deixou de quebrar envio. O log existe porque a última vez que
 * ela aconteceu não havia **nada** que ligasse "mensagem não chega" a "a row tem o
 * token velho" — o envio era aceito pelo provider e o job terminava com sucesso.
 *
 * É o sinal de que a âncora daquela linha precisa ser reconciliada ou apagada.
 */
function warnOnCredentialDrift(
  item: SubscriptionItem,
  instance: { instanceId: string; zApiToken: string | null },
): void {
  if (item.metadata.provider !== 'ZAPI') return

  const instanceDrifted = instance.instanceId !== item.metadata.zApiInstanceId
  const tokenDrifted = instance.zApiToken !== item.metadata.zApiInstanceToken

  if (!instanceDrifted && !tokenDrifted) return

  apiLogger.warn(
    {
      app: 'thinkzap',
      subscriptionItemId: item.id,
      /** Nunca o token: só qual dos dois campos divergiu. */
      itemInstanceId: item.metadata.zApiInstanceId,
      rowInstanceId: instance.instanceId,
      instanceDrifted,
      tokenDrifted,
    },
    'Âncora de instância com credencial divergente do item da SPA — envio usa a do item',
  )
}

/** Primeiro item cujo vínculo casa com o canal do evento. */
const findItemByChannel = (
  subscriptions: { items: SubscriptionItem[] }[],
  line: string,
): SubscriptionItem | undefined =>
  subscriptions
    .flatMap(subscription => subscription.items)
    .find(item => item.vinculatedChannel === line)
