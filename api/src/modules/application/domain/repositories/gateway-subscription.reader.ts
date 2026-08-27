import { GatewaySubscription } from '@/modules/application/domain/entities/gateway-subscription'

/**
 * Leitura da assinatura de um contrato no gateway.
 *
 * Port próprio, e não `PaymentGateway` inteiro, pelo mesmo par de motivos de
 * `PlanPriceReader`. O primeiro é escopo: ler quantidade cobrada não cria sessão nem
 * valida webhook. O segundo é **isolamento do caminho quente** —
 * `runtime-gateway-isolation.test.ts` proíbe que o processamento de mensagem alcance
 * o adapter do gateway, direta ou transitivamente, porque isso colocaria latência e
 * rate limit de um terceiro em cada mensagem recebida. Com o port aqui, quem exibe
 * cobrança depende de uma interface, e o adapter entra só na fiação (`main/`).
 *
 * Lança `GatewaySubscriptionUnreadableError` quando a assinatura não existe no
 * gateway ou a chamada falha. Quem chama trata a ausência como "não sei o que é
 * cobrado" — e a tela cala, em vez de somar valor de cadastro por contagem de linhas.
 */
export interface GatewaySubscriptionReader {
  readSubscription(gatewaySubscriptionId: string): Promise<GatewaySubscription>
}
