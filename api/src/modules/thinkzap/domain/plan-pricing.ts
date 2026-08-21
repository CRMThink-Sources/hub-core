/**
 * A **conta** que o preço do gateway implica.
 *
 * Existe porque o preço dos conectores é escalonado no gateway e o produto tratava
 * como valor unitário: a tela lia `ufCrm89Value` da SPA e multiplicava pela contagem
 * de linhas. Para price escalonado essa multiplicação não é aproximação, é conta
 * errada — e erra sempre para mais. Com degraus "até 1 = R$ 287,00" e "acima =
 * R$ 187,00", três linhas custam R$ 661,00 e a multiplicação diz R$ 861,00.
 *
 * Tudo aqui é **puro**: nada de Prisma, Bitrix, Redis ou gateway, igual a
 * `line-subscription` e `connector-trial`. É o que torna os casos de 1, 2 e 3 linhas
 * nos dois modos testáveis sem infraestrutura.
 *
 * A **forma** do preço mora em `application/domain/entities/plan-price.ts`, junto de
 * `Plan`: é parte da entidade, e mantê-la lá é o que impede a entidade de depender
 * deste módulo. Re-exportada aqui para quem calcula ter um só import.
 */
export type {
  PlanPrice,
  PriceRecurrence,
  PriceTier,
  TieringMode,
} from '@/modules/application/domain/entities/plan-price'

import type {
  PlanPrice,
  PriceTier,
  TieringMode,
} from '@/modules/application/domain/entities/plan-price'

export class UnknownTieringModeError extends Error {
  constructor(
    readonly planId: string,
    readonly mode: string,
  ) {
    super(
      `O plano "${planId}" tem price escalonado no modo "${mode}", que este produto ` +
        'não sabe calcular. O plano não é ofertável até o modo ser suportado — ' +
        'estimar o valor exibiria, ou cobraria, um número que ninguém definiu.',
    )
    this.name = 'UnknownTieringModeError'
  }
}

export class PriceTiersMissingError extends Error {
  constructor(
    readonly planId: string,
    readonly mode: TieringMode,
  ) {
    super(
      `O plano "${planId}" tem price escalonado (${mode}) sem nenhum degrau. Sem ` +
        'degrau não há valor a cobrar, e tratar como zero ofereceria o conector de graça.',
    )
    this.name = 'PriceTiersMissingError'
  }
}

/**
 * Quanto o plano custa no contrato, dada a contagem de linhas dele.
 *
 * Só apresentação: quem aplica os degraus na cobrança é o gateway, que recebe um
 * `line_item` com o price id e a quantidade. Esta função existe para a tela dizer o
 * mesmo número que a fatura — não para decidir o que é cobrado.
 *
 * Zero linha custa zero **sem consultar degrau**: contrato sem linha daquele plano
 * não tem o que precificar, e o primeiro degrau responderia como se tivesse uma.
 */
export function planAmountForLines(input: {
  planId: string
  price: PlanPrice
  lines: number
}): number {
  const { planId, price, lines } = input

  if (lines <= 0) return 0

  if (price.kind === 'unit') return price.unitAmount * lines

  if (price.tiers.length === 0) {
    throw new PriceTiersMissingError(planId, price.mode)
  }

  if (price.mode === 'graduated') return graduatedAmount(price.tiers, lines)
  if (price.mode === 'volume') return volumeAmount(price.tiers, lines)

  /**
   * Modo que o cálculo não conhece **recusa**. É a mesma falha fechada do plano sem
   * price id: não exibir custa uma venda e aparece no diagnóstico, exibir errado
   * aparece na fatura do cliente.
   */
  throw new UnknownTieringModeError(planId, String(price.mode))
}

/**
 * Quanto o contrato **aumenta** com uma linha a mais daquele plano.
 *
 * Derivado do total, e não de uma fórmula própria, porque as duas coisas só
 * coincidem em `graduated`. Em `volume` as linhas que já existem passam a pagar o
 * degrau novo: sair de 1 para 2 linhas sob 257/187 custa R$ 117,00 de acréscimo
 * (374 − 257), enquanto o degrau alcançado é R$ 187,00. Uma fórmula própria acertaria
 * um modo e erraria o outro; a subtração acerta os dois por construção, e qualquer
 * modo futuro herda isso.
 */
export function planMarginalForNextLine(input: {
  planId: string
  price: PlanPrice
  /** Linhas ativas **hoje** daquele plano. */
  currentLines: number
}): number {
  const { planId, price, currentLines } = input
  const from = Math.max(0, currentLines)

  return (
    planAmountForLines({ planId, price, lines: from + 1 }) -
    planAmountForLines({ planId, price, lines: from })
  )
}

/** Cada unidade paga o degrau em que ela cai. */
function graduatedAmount(tiers: PriceTier[], lines: number): number {
  let remaining = lines
  let consumed = 0
  let total = 0

  for (const tier of tiers) {
    if (remaining <= 0) break

    /**
     * `upTo` é acumulado, não o tamanho do degrau: um degrau "até 3" depois de um
     * "até 1" cobre 2 unidades. Tratá-lo como tamanho cobraria três vezes a faixa.
     */
    const capacity = tier.upTo == null ? remaining : tier.upTo - consumed
    const units = Math.min(remaining, Math.max(0, capacity))

    total += units * tier.unitAmount
    remaining -= units
    consumed += units
  }

  /**
   * Sobrou unidade sem degrau: só acontece se o último degrau tiver `upTo` e a
   * quantidade passar dele — cadastro em que o gateway também não sabe cobrar. O
   * último degrau responde pelo resto, que é o que o gateway faz na prática, e o
   * diagnóstico é quem acusa o cadastro.
   */
  if (remaining > 0) {
    total += remaining * tiers[tiers.length - 1]!.unitAmount
  }

  return total
}

/** Todas as unidades pagam o degrau alcançado pela quantidade total. */
function volumeAmount(tiers: PriceTier[], lines: number): number {
  const tier =
    tiers.find(
      candidate => candidate.upTo == null || lines <= candidate.upTo,
    ) ?? tiers[tiers.length - 1]!

  return tier.unitAmount * lines
}
