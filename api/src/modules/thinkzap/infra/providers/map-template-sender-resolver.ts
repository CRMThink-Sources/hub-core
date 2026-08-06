import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { TemplateSendNotSupportedError } from '@/modules/thinkzap/domain/ports/template-errors'
import { TemplateMessageSender } from '@/modules/thinkzap/domain/ports/template-message-sender.port'
import {
  TemplateMessageSenderResolver,
  TemplateSendTargetRef,
} from '@/modules/thinkzap/domain/ports/template-sender-resolver.port'

/**
 * Fábrica de sender por provider. É função e não instância — diferente de
 * `MapTemplateProviderResolver`, cujos adapters são escopados por WABA e podem
 * viver no mapa: aqui o sender carrega canal e destinatário, que mudam a cada
 * envio, então o mapa guarda como construir e não o construído.
 */
export type TemplateSenderFactory = (
  target: TemplateSendTargetRef,
) => TemplateMessageSender

type FactoryMap = Partial<Record<ConnectorProvider, TemplateSenderFactory>>

/**
 * Resolver baseado em mapa `ConnectorProvider` → fábrica de sender de template.
 *
 * Provider não registrado (HubMessage sem configuração de ambiente, por exemplo)
 * lança `TemplateSendNotSupportedError` — **sem nenhuma chamada remota**, que é o
 * ponto: a recusa por capacidade tem de custar zero requisição.
 *
 * O `env` fica fora daqui de propósito, na factory de composição em `main/`: é o
 * que torna este resolver testável sem variável de ambiente.
 */
export class MapTemplateSenderResolver implements TemplateMessageSenderResolver {
  constructor(private readonly factories: FactoryMap) {}

  resolve(
    provider: ConnectorProvider,
    target: TemplateSendTargetRef,
  ): TemplateMessageSender {
    const factory = this.factories[provider]
    if (!factory) {
      throw new TemplateSendNotSupportedError(provider)
    }
    return factory(target)
  }
}
