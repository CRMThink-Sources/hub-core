import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { LineEntitlement } from '@/modules/thinkzap/domain/connector-trial'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

/**
 * Desconecta no provider a linha cujo trial venceu.
 *
 * Sem isto o pareamento do WhatsApp do cliente sobrevive à expiração: a instância
 * continua conectada, o cliente final continua mandando mensagem, e o app descarta
 * na entrada. **Mensagem de cliente entrando e desaparecendo sem rastro é pior que
 * linha visivelmente desconectada** — o dono do número não tem como saber que o
 * canal morreu.
 *
 * É `disconnect`, nunca `unsubscribe`. Os dois parecem vizinhos e não são: um é
 * sessão, o outro é cobrança. Trial nunca chamou `subscribe` (decisão 4 do
 * desenho), então não há assinatura no provider para cancelar, e `unsubscribe` aqui
 * atacaria uma cobrança que não existe.
 *
 * ## Por que dispara de uma leitura
 *
 * A expiração é avaliada na leitura, não por job — não há momento em que "o trial
 * vence", só requisições que percebem que venceu. Então quem percebe age, e para
 * isso não pode fazer o chamador esperar: `schedule` **não** é `await`ado, não
 * lança, e falha só registra warning. O bloqueio no app já aconteceu de qualquer
 * forma; o `disconnect` é o efeito no mundo, e ele pode chegar atrasado.
 */
export class DisconnectExpiredLine {
  /**
   * Itens que este processo já desconectou, ou está desconectando agora.
   *
   * **Marcado antes do `await`, não depois.** Uma linha expirada é resolvida por
   * várias requisições ao mesmo tempo, e um memo preenchido só no sucesso deixaria
   * todas passarem pelo guard antes de a primeira terminar — o efeito seria N
   * `disconnect` simultâneos em vez de um.
   *
   * A falha **desmarca**, para a tentativa se repetir na resolução seguinte: sem job
   * agendado, é o único retry que existe. O custo é que um restart do processo repete
   * um `disconnect` já feito, e isso é inofensivo — desconectar recurso já
   * desconectado não é erro no provider.
   */
  private readonly disconnected = new Set<string>()

  constructor(private readonly providers: ConnectorProviderResolver) {}

  /**
   * Dispara e devolve na hora.
   *
   * `void` e não `Promise`: assinatura que não dá o que esperar é o que impede um
   * chamador de `await`ar sem perceber e pagar a latência do provider numa leitura.
   */
  schedule(item: SubscriptionItem, entitlement: LineEntitlement): void {
    if (entitlement !== 'trial-expired') return

    void this.execute(item)
  }

  /**
   * A tentativa em si. Pública para o teste poder esperar por ela; produção usa
   * `schedule`.
   */
  async execute(item: SubscriptionItem): Promise<void> {
    const ref = resourceRef(item)
    if (!ref) return

    if (this.disconnected.has(item.id)) return
    this.disconnected.add(item.id)

    try {
      await this.providers.resolve(ref.provider).disconnect(ref.resource)

      apiLogger.info(
        {
          app: 'thinkzap',
          subscriptionItemId: item.id,
          provider: ref.provider,
        },
        'Recurso remoto desconectado por trial expirado',
      )
    } catch (error) {
      /** Desmarca: a resolução seguinte tenta de novo. */
      this.disconnected.delete(item.id)

      /**
       * Warning, não erro: o cliente já está bloqueado no app, e este `disconnect`
       * é a limpeza no provider. Subir a exceção derrubaria a leitura que a
       * detectou — uma consulta de ajustes falhando porque a Z-API está fora.
       */
      logThinkzapError(
        apiLogger,
        'thinkzap.provisioning.disconnect_expired_failed',
        {
          app: 'thinkzap',
          subscriptionItemId: item.id,
          provider: ref.provider,
          err: error,
        },
        {
          level: 'warn',
          msg: 'Falha ao desconectar recurso remoto de trial expirado — nova tentativa na próxima resolução',
        },
      )
    }
  }
}

/**
 * A referência do recurso remoto, por provider.
 *
 * `null` para item `NONE`: não há recurso provisionado, então não há o que
 * desconectar — e é estado normal, não erro.
 */
function resourceRef(item: SubscriptionItem): {
  provider: ConnectorProvider
  resource: {
    instanceId: string
    zApiToken?: string | null
    channelId?: string | null
  }
} | null {
  if (item.metadata.provider === 'ZAPI') {
    return {
      provider: ConnectorProvider.ZAPI,
      resource: {
        instanceId: item.metadata.zApiInstanceId,
        zApiToken: item.metadata.zApiInstanceToken,
      },
    }
  }

  if (item.metadata.provider === 'HUBMESSAGE') {
    return {
      provider: ConnectorProvider.HUBMESSAGE,
      resource: {
        instanceId: item.metadata.hubmessageChannelId,
        channelId: item.metadata.hubmessageChannelId,
      },
    }
  }

  return null
}
