import type { AplicationContext } from '@/modules/application/application/get-aplication-context'
import type { Subscription } from '@/modules/application/domain/entities/subscription'

/**
 * Regras do trial de conector, puras.
 *
 * Nada aqui toca Prisma, Bitrix ou Redis: estas funções são chamadas de dentro do
 * caminho quente de mensagem, e a decisão tem que ser aritmética sobre dado que o
 * chamador já tem em mãos.
 */

/** Duração do trial, em dias de calendário. Regra de negócio, não parâmetro. */
export const TRIAL_DURATION_DAYS = 3

/**
 * Fuso do contrato.
 *
 * Serve a **uma** direção só: transformar um instante (`now`) no dia de calendário
 * que ele é para o cliente. Um trial ativado às 22:00 de Brasília é de hoje — em
 * UTC já é amanhã, e contar de lá daria um dia a mais e uma data que não bate com
 * a que o cliente acabou de ver na tela.
 *
 * Constante, e não configuração de ambiente: qual dia venceu não pode divergir
 * entre staging e produção.
 */
export const BILLING_TIME_ZONE = 'America/Sao_Paulo'

/**
 * O dia de calendário de um instante, no fuso do contrato.
 *
 * `Intl` em vez de aritmética de offset porque horário de verão existe: somar três
 * horas fixas acerta parte do ano e erra a outra. `Intl` é global, então isto não
 * viola a regra de este módulo não importar nada além de tipo.
 */
function billingDayOf(instant: Date): {
  year: number
  month: number
  day: number
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BILLING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)

  const value = (type: string) =>
    Number(parts.find(part => part.type === type)?.value)

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
  }
}

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
 * A janela do trial, em **dias de calendário**, a partir do dia da ativação.
 *
 * Recebe o `now` em vez de chamar `new Date()`: o caso de uso decide o instante,
 * e o teste não precisa de relógio falso.
 *
 * O dia da ativação é lido no fuso do contrato (`BILLING_TIME_ZONE`); a janela é
 * ancorada em UTC, seguindo a convenção de `Subscription.currentPeriodStart` — o
 * componente UTC é o dia, e a hora é âncora. Início no começo do dia da ativação,
 * fim no **último instante** do terceiro dia depois dele: o cliente tem o último
 * dia inteiro.
 *
 * Antes disto a janela era `now + 3 * 24h`, o que dava um fim no meio do dia e
 * gravava um instante que o CRM reinterpretava — a ponta de escrita do bug de D-1.
 */
export function trialWindow(now: Date): {
  currentPeriodStart: Date
  currentPeriodEnd: Date
} {
  const { year, month, day } = billingDayOf(now)

  return {
    currentPeriodStart: new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)),
    /**
     * `day + TRIAL_DURATION_DAYS` transborda o mês de propósito: `Date.UTC` resolve
     * — dia 30 de agosto mais 3 é 2 de setembro, sem aritmética de calendário aqui.
     */
    currentPeriodEnd: new Date(
      Date.UTC(year, month - 1, day + TRIAL_DURATION_DAYS, 23, 59, 59, 999),
    ),
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
