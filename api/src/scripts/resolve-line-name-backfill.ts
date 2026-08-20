import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { isGeneratedLineName } from '@/modules/thinkzap/application/helpers/line-resource-metadata'

/**
 * A parte **pura** do backfill do nome da linha: item + nome que a Z-API tem →
 * nome a gravar, ou o motivo de não gravar.
 *
 * Separada do runner porque é onde está a decisão, e é a única parte que precisa
 * de teste. O runner faz rede: lista os itens, consulta a Z-API e escreve na SPA.
 *
 * Existe porque corrigir a origem do nome **causa** uma regressão sem ela: quem
 * renomeou uma linha Z-API até aqui gravou só no provider, e o `title` do item
 * continua sendo o gerado na criação. Sem trazer esses nomes, toda linha
 * renomeada volta a se chamar `WhatsApp` no dia do deploy.
 */

export type LineNameBackfillOutcome =
  | { kind: 'write'; itemId: string; name: string }
  | {
      kind: 'skipped'
      itemId: string
      reason:
        | 'outro-provider'
        /** O `title` já foi ajustado — por esta tela ou à mão no CRM. */
        | 'nome-ja-ajustado'
        /** A Z-API não tem nome próprio, ou tem só o prefixo. */
        | 'sem-nome-remoto'
        /** Nada a fazer: os dois lados já dizem a mesma coisa. */
        | 'ja-igual'
    }

/**
 * O prefixo `"{domínio} | "` é convenção de `RenameLineOnProviderUseCase`, e é o
 * que o produto nunca exibiu. Tirado aqui pelo **primeiro** separador: nome que
 * contenha ` | ` depois do prefixo continua inteiro.
 */
export const stripDomainPrefix = (raw: string): string => {
  const separator = ' | '
  const index = raw.indexOf(separator)
  return index === -1 ? raw : raw.slice(index + separator.length)
}

export function resolveLineNameBackfill(input: {
  itemId: string
  provider: ConnectorProvider | 'NONE'
  /** O `title` que o item tem hoje na SPA. */
  currentName: string
  /** O nome na instância da Z-API, cru — com prefixo, se houver. */
  remoteName: string | undefined
}): LineNameBackfillOutcome {
  /**
   * Só a Z-API tem nome fora do item. O da HubMessage sempre esteve no `title`, e
   * o provider nem expõe leitura de canal — não há de onde trazer nada.
   */
  if (input.provider !== ConnectorProvider.ZAPI) {
    return { kind: 'skipped', itemId: input.itemId, reason: 'outro-provider' }
  }

  /**
   * O guard central. Escrever por cima de um `title` já ajustado apagaria o nome
   * de quem editou o item direto no CRM — que é justamente o caminho que o
   * suporte usa hoje, porque a tela não funcionava.
   */
  if (!isGeneratedLineName(input.currentName, ConnectorProvider.ZAPI)) {
    return { kind: 'skipped', itemId: input.itemId, reason: 'nome-ja-ajustado' }
  }

  /**
   * Tira o prefixo **antes** de aparar: `"acme | "` aparado vira `"acme |"`, e o
   * separador ` | ` deixa de casar — o prefixo inteiro passaria por nome.
   */
  const remote = stripDomainPrefix(input.remoteName ?? '').trim()

  if (remote === '') {
    return { kind: 'skipped', itemId: input.itemId, reason: 'sem-nome-remoto' }
  }

  if (remote === input.currentName.trim()) {
    return { kind: 'skipped', itemId: input.itemId, reason: 'ja-igual' }
  }

  return { kind: 'write', itemId: input.itemId, name: remote }
}
