import type { AplicationContext } from '@/modules/application/application/get-aplication-context'
import type { Subscription } from '@/modules/application/domain/entities/subscription'

/**
 * Regras do trial de conector, puras.
 *
 * Nada aqui toca Prisma, Bitrix ou Redis: estas funções são chamadas de dentro do
 * caminho quente de mensagem, e a decisão tem que ser aritmética sobre dado que o
 * chamador já tem em mãos.
 */

/** Duração do trial. Regra de negócio, não parâmetro de entrada. */
export const TRIAL_DURATION_DAYS = 3

const DAY_IN_MS = 24 * 60 * 60 * 1000

/**
 * Habilitação de uma linha.
 *
 * `trial-expired` é separado de `inactive` porque a tela trata os dois de forma
 * diferente: trial vencido explica o que aconteceu e o que fazer, assinatura
 * cancelada é outro assunto.
 */
export type LineEntitlement = 'active' | 'trial-expired' | 'inactive'

/**
 * Status que descrevem um teste, não um contrato.
 *
 * `trialing` é o teste em andamento — que pode já ter passado da janela, porque
 * nada flipa status no banco. `trial_expired` é o teste encerrado **por
 * marcação**, feita de fora do produto. Os dois são teste; a diferença é quem
 * encerrou.
 *
 * **Existe como predicado, e não como comparação literal em cada chamador,**
 * porque `status === 'trialing'` estava escrito em cinco lugares — consulta de
 * estado do trial, listagem de instâncias, classificação de inelegibilidade e as
 * duas guardas de cobrança no provider. Um status de teste novo virou cinco bugs
 * de uma vez, e o próximo faria o mesmo.
 *
 * **Não** substitui `isTrialSubscription` de `line-subscription.ts`: aquela
 * pergunta é "esta assinatura é grátis por construção", respondida por uma
 * propriedade do plano, e vale para um trial contratado que ficou `cancelled`.
 * Esta é "este status descreve um teste". Unificar as duas quebraria a primeira.
 *
 * Este módulo não menciona meio de cobrança de propósito, e há teste estrutural
 * sobre o texto dele afirmando isso — inclusive em comentário.
 */
export function isTrialStatus(status: Subscription['status']): boolean {
  return status === 'trialing' || status === 'trial_expired'
}

/**
 * A janela do trial, a partir do momento da ativação.
 *
 * Recebe o `now` em vez de chamar `new Date()`: o caso de uso decide o instante,
 * e o teste não precisa de relógio falso.
 */
export function trialWindow(now: Date): {
  currentPeriodStart: Date
  currentPeriodEnd: Date
} {
  return {
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + TRIAL_DURATION_DAYS * DAY_IN_MS),
  }
}

/**
 * Habilitação da linha, derivada da assinatura pai e do agora.
 *
 * **Nenhum caminho de runtime lê `subscription.status` cru para decidir
 * comportamento.** O status persistido continua dizendo `trialing` depois de a
 * janela passar — nada flipa estado no banco quando o trial vence, porque um job
 * agendado teria duas falhas que a avaliação por leitura não tem: atrasado, deixa
 * a linha funcionando de graça; rodando duas vezes, tem que ser idempotente sobre
 * estado de cobrança.
 *
 * A janela é a verdade **para o teste em andamento**. É por isso que isto é uma
 * função de `(assinatura, agora)` e não um campo.
 *
 * `trial_expired` é o segundo caminho para o mesmo veredito, e esse não depende do
 * agora: é o teste que alguém encerrou no CRM.
 *
 * Assinatura ausente resolve `inactive`: sem janela nem status não há o que
 * autorize a linha, e o default conservador é não funcionar.
 */
export function resolveLineEntitlement(
  subscription: Pick<Subscription, 'status' | 'currentPeriodEnd'> | null,
  now: Date,
): LineEntitlement {
  if (!subscription) return 'inactive'

  switch (subscription.status) {
    case 'active':
      return 'active'
    case 'trialing':
      /**
       * `>` e não `>=`: o último instante da janela ainda vale. Cortar em
       * `currentPeriodEnd` exato tiraria um tick do cliente sem motivo.
       */
      return now.getTime() > subscription.currentPeriodEnd.getTime()
        ? 'trial-expired'
        : 'active'
    case 'trial_expired':
      /**
       * Sem consultar a janela, de propósito. A regra é: **a janela só expira, o
       * status também pode expirar, e nenhum dos dois reabre.** Ler
       * `currentPeriodEnd` aqui faria uma marcação de encerramento com período no
       * futuro voltar a habilitar a linha — o oposto do que quem marcou pediu.
       */
      return 'trial-expired'
    case 'cancelled':
    case 'past_due':
      return 'inactive'
    default:
      /**
       * Inalcançável pelo tipo, e mesmo assim explícito: esta é uma decisão de
       * autorização, e status que o `switch` não reconhece não pode virar
       * `undefined` — que compara diferente de `'active'` em alguns pontos e
       * falseia como habilitado em outros. O mapper da SPA já rejeita status
       * desconhecido, então isto cobre dado construído por fora dele.
       */
      return 'inactive'
  }
}

/** Por que a instalação não pode ativar o trial. */
export type TrialIneligibilityReason =
  /** Já tem assinatura de trial, mesmo expirada — ativou uma vez, não ativa de novo. */
  | 'already-used'
  /** Tem assinatura ativa ou vencida: é cliente, não candidato a teste. */
  | 'has-contract'
  /** Sem espelho na SPA 1060, então não há parent onde pendurar a assinatura. */
  | 'no-spa-mirror'

export type TrialEligibility =
  | { eligible: true }
  | { eligible: false; reason: TrialIneligibilityReason }

/**
 * Elegibilidade ao trial.
 *
 * O critério é **ausência de assinatura**, não "ausência de assinatura em teste".
 * Trial expirado continua existindo como assinatura, e é isso que faz "nunca
 * ativou" ser verificável sem flag próprio: a ausência é o estado inicial, e
 * ativar a destrói para sempre.
 *
 * Cliente pagante também não é elegível — acidente feliz da mesma regra.
 *
 * *Consequência aceita:* apagar a assinatura no CRM à mão devolve a elegibilidade.
 * É operação manual num CRM interno, auditável por ele mesmo, e blindar isso
 * exigiria o registro imutável que a decisão 1 do design descarta.
 */
export function checkTrialEligibility(
  context: Pick<AplicationContext, 'aplication' | 'subscriptions'>,
): TrialEligibility {
  /**
   * Verificado antes das assinaturas: sem `spaId` a listagem nem roda (o filtro
   * depende dele), então `subscriptions: []` aqui significaria "elegível" por
   * ausência de dado que não foi consultado.
   */
  if (!context.aplication.spaId) {
    return { eligible: false, reason: 'no-spa-mirror' }
  }

  if (context.subscriptions.length === 0) return { eligible: true }

  /**
   * A razão distingue os dois casos para a tela: "seu teste acabou" e "você já é
   * cliente" pedem mensagens diferentes, e ambos caem em não-elegível.
   */
  const onlyTrials = context.subscriptions.every(subscription =>
    isTrialStatus(subscription.status),
  )

  return {
    eligible: false,
    reason: onlyTrials ? 'already-used' : 'has-contract',
  }
}
