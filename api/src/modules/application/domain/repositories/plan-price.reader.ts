import { PlanPrice } from '@/modules/application/domain/entities/plan-price'

/**
 * Leitura do preço de um price no gateway.
 *
 * Port próprio, e não `PaymentGateway` inteiro, por dois motivos. O primeiro é
 * escopo: hidratar preço não cria sessão nem valida webhook. O segundo é **isolamento
 * do caminho quente** — `runtime-gateway-isolation.test.ts` proíbe que o processamento
 * de mensagem alcance o adapter do gateway, direta ou transitivamente, porque isso
 * colocaria a latência e o rate limit de um terceiro em cada mensagem recebida. Com o
 * port aqui, quem exibe preço depende de uma interface, e o adapter entra só na
 * fiação (`main/`).
 */
export interface PlanPriceReader {
  readPrice(priceId: string): Promise<PlanPrice>
}
