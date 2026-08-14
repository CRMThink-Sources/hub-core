import 'dotenv/config'

import { env } from '@/config/env'
import { SUBSCRIPTION_ITEM_PROVIDER_FIELD } from '@/modules/application/infra/bitrix/ensure-subscription-item-provider-field'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { resolveLineNameBackfill } from './resolve-line-name-backfill'

/**
 * Traz para o item da SPA o nome das linhas Z-API que foram renomeadas quando o
 * rename só ia ao provider.
 *
 * O nome da linha passou a viver no item (`title`), que é o que a lista de
 * conexões, o cabeçalho da configuração e o seletor do widget sempre exibiram.
 * Corrigir a origem, sozinho, **causa** uma regressão: quem renomeou até aqui
 * gravou só na Z-API, e o `title` continuou sendo o gerado na criação — então
 * toda linha renomeada volta a se chamar `WhatsApp` no dia do deploy.
 *
 * **Escreve só com `--apply`.** Sem a flag é relatório, como nos outros backfills
 * deste repo.
 *
 * **Nunca sobrescreve nome ajustado.** A decisão vive em `resolveLineNameBackfill`:
 * só escreve onde o `title` ainda casa com um nome gerado. Rodar de novo é seguro —
 * depois da primeira passada o título deixa de ser gerado e o item passa a ser
 * ignorado.
 *
 * **Pagina a listagem.** `crm.item.list` devolve 50 itens por página e sinaliza a
 * seguinte em `next`; sem seguir o cursor, o backfill cobriria os 50 primeiros e
 * reportaria sucesso.
 */

function parseArgs(): { apply: boolean } {
  return { apply: process.argv.slice(2).includes('--apply') }
}

type RawItem = Record<string, unknown> & { id: string }

/** Os campos crus que a decisão usa. `select` explícito: o resto é peso. */
const SELECT = [
  'id',
  'title',
  SUBSCRIPTION_ITEM_PROVIDER_FIELD,
  'ufCrm93ZApiInstanceId',
  'ufCrm93ZApiInstanceToken',
]

async function listAllItems(bitrix: BitrixClient): Promise<RawItem[]> {
  const items: RawItem[] = []
  let start: number | undefined = undefined

  do {
    const response = await bitrix.listCrmItems(
      env.payments.spa.subscriptionItemEntityType,
      {},
      { select: SELECT, ...(start !== undefined && { start }) },
    )

    items.push(...((response.result?.items ?? []) as RawItem[]))
    start = response.next
  } while (start !== undefined)

  return items
}

/**
 * O valor do enum como texto: o provider vem cru da SPA, e comparar `string` com
 * membro de enum é o tipo de comparação que o lint recusa — com razão, porque
 * esconde o fato de que o lado cru pode ser qualquer coisa.
 */
const ZAPI: string = ConnectorProvider.ZAPI

/** Vazio é ausência; o que não for string também. */
const text = (raw: unknown): string | undefined => {
  const value = typeof raw === 'string' ? raw.trim() : ''

  return value === '' ? undefined : value
}

async function main(): Promise<void> {
  const { apply } = parseArgs()
  const bitrix = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const zApi = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

  const items = await listAllItems(bitrix)
  console.log(
    `Itens na SPA ${env.payments.spa.subscriptionItemEntityType}: ${items.length}`,
  )

  let written = 0
  let failed = 0
  const skipped: Record<string, number> = {}

  const ignore = (itemId: string, reason: string): void => {
    skipped[reason] = (skipped[reason] ?? 0) + 1
    console.log(`[ignorado] item ${itemId}: ${reason}`)
  }

  for (const raw of items) {
    const itemId = String(raw.id)
    const provider = (
      text(raw[SUBSCRIPTION_ITEM_PROVIDER_FIELD]) ?? ''
    ).toUpperCase()

    /**
     * Itens de outro provider saem **antes** da rede: a decisão os ignoraria de
     * qualquer forma, e consultar a Z-API por eles seria uma chamada por item que
     * nunca produz escrita.
     */
    if (provider !== ZAPI) {
      ignore(itemId, 'outro-provider')
      continue
    }

    const instanceId = text(raw.ufCrm93ZApiInstanceId)
    const token = text(raw.ufCrm93ZApiInstanceToken)

    if (!instanceId || !token) {
      ignore(itemId, 'sem-credencial')
      continue
    }

    /**
     * Falha de leitura de uma linha não interrompe o backfill: uma instância
     * apagada na Z-API não pode impedir que as outras recebam o nome de volta.
     */
    let remoteName: string | undefined
    try {
      remoteName = (await zApi.getInstance(instanceId, token)).name
    } catch (error) {
      failed++
      console.warn(
        `[falhou] leitura da instância ${instanceId} (item ${itemId}):`,
        error,
      )
      continue
    }

    const outcome = resolveLineNameBackfill({
      itemId,
      provider: ConnectorProvider.ZAPI,
      currentName: text(raw.title) ?? '',
      remoteName,
    })

    if (outcome.kind === 'skipped') {
      ignore(outcome.itemId, outcome.reason)
      continue
    }

    if (!apply) {
      console.log(
        `[dry-run] item ${outcome.itemId}: "${text(raw.title) ?? ''}" → "${outcome.name}"`,
      )
      written++
      continue
    }

    try {
      await bitrix.updateCrmItem(
        env.payments.spa.subscriptionItemEntityType,
        outcome.itemId,
        { title: outcome.name },
      )
      written++
      console.log(`[gravado] item ${outcome.itemId} → "${outcome.name}"`)
    } catch (error) {
      failed++
      console.error(`[falhou] item ${outcome.itemId}:`, error)
    }
  }

  const ignored = Object.entries(skipped)
    .map(([reason, count]) => `${count} ${reason}`)
    .join(', ')

  console.log(
    `\nResumo${apply ? '' : ' (dry-run)'}: ${written} nome(s), ` +
      `${ignored || '0 ignorado(s)'}, ${failed} falha(s)`,
  )

  if (!apply) {
    console.log('Nada foi gravado. Rode com --apply para gravar.')
  }
}

void main().catch(error => {
  console.error('Backfill do nome da linha falhou:', error)
  process.exit(1)
})
