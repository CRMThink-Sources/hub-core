import { Plan } from '@/modules/application/domain/entities/plan'

/**
 * Leitura do catálogo ofertável — os planos `active`, com price id no ambiente em
 * uso e com conector declarado.
 *
 * Existe porque a composição do contrato passou a ser derivada do **conector de cada
 * item**, e resolver o plano de um conector exige o catálogo. Antes o plano vinha
 * hidratado na assinatura que hospedava o item, e a leitura não precisava de nada
 * além do contexto.
 *
 * Port, e não a classe `ListOfferablePlans`, pelo mesmo motivo de `PlanPriceReader`:
 * `GetLineSubscriptionState` é entrypoint de runtime, e
 * `runtime-gateway-isolation.test.ts` reprova qualquer caminho de import que alcance
 * o adapter do gateway a partir dele. A implementação entra na fiação (`main/`).
 *
 * Devolve as **entidades**, com `gatewayId`: é o price id que casa o plano com o
 * `line_item` do gateway. Nada daqui vai para a resposta de nenhuma rota — o price
 * id fora da aplicação seria escolher quanto pagar.
 */
export interface OfferablePlanReader {
  listOfferable(): Promise<Plan[]>
}
