import { env } from '@/config/env'
import { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import { PlanNotFoundError } from '@/modules/application/domain/errors/plan-not-found.error'
import { InvalidBitrixPlanError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-plan.error'

export class TrialPlanNotConfiguredError extends Error {
  constructor() {
    super(
      'Plano de trial não configurado: defina THINKZAP_TRIAL_PLAN_ID com o id do ' +
        `item de plano na SPA ${env.payments.spa.planEntityType}.`,
    )
    this.name = 'TrialPlanNotConfiguredError'
  }
}

export class TrialPlanMissingError extends Error {
  constructor(planId: string, detail: string) {
    super(
      `Plano de trial "${planId}" não é utilizável na SPA ${env.payments.spa.planEntityType}: ` +
        `${detail}. Sem um plano válido a leitura do contexto da instalação passa a ` +
        'falhar, não só a ativação.',
    )
    this.name = 'TrialPlanMissingError'
  }
}

/**
 * O erro é problema de **configuração** do plano, ou de infraestrutura?
 *
 * Item ausente e item com shape inválido são configuração: alguém tem que mexer no
 * CRM. Qualquer outra coisa — Bitrix fora, webhook errado, timeout — é
 * infraestrutura e **tem que propagar**.
 *
 * Tratar os dois igual faria uma indisponibilidade passageira aparecer na tela como
 * "plano de teste não configurado, fale com o suporte", mandando o cliente abrir
 * chamado por algo que se resolve sozinho.
 */
function isPlanConfigurationError(error: unknown): boolean {
  return (
    error instanceof PlanNotFoundError ||
    error instanceof InvalidBitrixPlanError
  )
}

/**
 * Garante que o plano de trial existe antes de qualquer efeito.
 *
 * **Por que isto é uma verificação e não uma suposição:** `Subscription.plan` é
 * hidratado por `getPlan`, que lança `PlanNotFoundError`. Essa exceção sobe por
 * `getSubscriptionsByAplication`, ou seja, uma assinatura apontando para plano
 * inexistente **derruba a leitura do contexto inteiro** da instalação — lista de
 * linhas, widget e roteamento de mensagem. O sintoma ficaria a quilômetros da causa.
 *
 * Chamado **antes** de provisionar no provider, para que configuração faltando não
 * deixe recurso remoto órfão a cada tentativa.
 */
export async function ensureTrialPlan(plans: PlanRepository): Promise<string> {
  const planId = env.payments.trialPlanId

  if (!planId) throw new TrialPlanNotConfiguredError()

  try {
    await plans.getPlan(planId)
  } catch (error) {
    if (isPlanConfigurationError(error)) {
      throw new TrialPlanMissingError(
        planId,
        error instanceof PlanNotFoundError
          ? 'o item não existe'
          : 'o item existe mas está incompleto — confira valor e intervalo de cobrança',
      )
    }
    throw error
  }

  return planId
}

/**
 * `true` quando o trial está configurado e utilizável. Para a rota de estado.
 *
 * **Só engole erro de configuração.** Falha de leitura propaga, para a tela dizer
 * "não foi possível verificar" em vez de "não está configurado" — a segunda é uma
 * afirmação sobre o ambiente que não se sustenta quando o Bitrix está fora.
 */
export async function isTrialPlanAvailable(
  plans: PlanRepository,
): Promise<boolean> {
  try {
    await ensureTrialPlan(plans)
    return true
  } catch (error) {
    if (
      error instanceof TrialPlanNotConfiguredError ||
      error instanceof TrialPlanMissingError
    ) {
      return false
    }
    throw error
  }
}
