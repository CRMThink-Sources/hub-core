import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { InteractiveButtonSendNotSupportedError } from '@/modules/thinkzap/domain/ports/button-errors'
import { InteractiveButtonSender } from '@/modules/thinkzap/domain/ports/interactive-button-sender.port'
import {
  InteractiveButtonSenderResolver,
  InteractiveButtonSendTargetRef,
} from '@/modules/thinkzap/domain/ports/interactive-button-sender-resolver.port'

/**
 * Fábrica de sender por provider — mirror de `TemplateSenderFactory`: o sender
 * carrega canal/instância e destinatário, que mudam a cada envio, então o
 * mapa guarda como construir e não o construído.
 */
export type InteractiveButtonSenderFactory = (
  target: InteractiveButtonSendTargetRef,
) => InteractiveButtonSender

type FactoryMap = Partial<
  Record<ConnectorProvider, InteractiveButtonSenderFactory>
>

/**
 * Resolver baseado em mapa `ConnectorProvider` → fábrica de sender de botões.
 *
 * Ao contrário de `MapTemplateSenderResolver`, em operação normal os dois
 * providers estão sempre registrados — `InteractiveButtonSendNotSupportedError`
 * só dispara em ambiente mal configurado (HubMessage sem
 * `HUBMESSAGE_SECRET_KEY`).
 */
export class MapInteractiveButtonSenderResolver implements InteractiveButtonSenderResolver {
  constructor(private readonly factories: FactoryMap) {}

  resolve(
    provider: ConnectorProvider,
    target: InteractiveButtonSendTargetRef,
  ): InteractiveButtonSender {
    const factory = this.factories[provider]
    if (!factory) {
      throw new InteractiveButtonSendNotSupportedError(provider)
    }
    return factory(target)
  }
}
