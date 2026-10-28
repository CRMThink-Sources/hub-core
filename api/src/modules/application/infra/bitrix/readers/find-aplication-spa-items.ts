import { env } from '@/config/env'
import { BITRIX_SPA_CLIENT_FIELDS } from '@/shared/domain/config/bitrix.env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

/** Igual ao limite da listagem do Bitrix: o filtro por domínio vai em lotes. */
const BATCH_SIZE = 50

/** Domínio como chave de comparação: o CRM guarda o que o install mandou, com caixa. */
export const normalizeDomain = (domain: string) => domain.trim().toLowerCase()

/**
 * Ids dos itens da SPA 1060 de um app code, agrupados pelo domínio normalizado.
 *
 * É a busca do vínculo instalação → espelho, pelo par (domínio, app code): o backfill de
 * `spa_id` e o "Vincular espelho" do backoffice usam esta mesma função, para que os dois
 * nunca discordem sobre qual item é o espelho de qual instalação.
 *
 * `appCodeId` é o id do app code (`crmthink.thinkzap`), que é o que o install grava no
 * `APP_CODE` do item — `appCode.code` é o id do marketplace e não casaria.
 *
 * Devolve **todos** os itens por domínio, em ordem crescente de id: decidir o que fazer
 * com duplicata é de quem chama. Lança se o Bitrix falhar — aqui não há fallback que não
 * minta sobre a existência do item.
 */
export async function findAplicationSpaItems(
  bitrix: BitrixClient,
  appCodeId: string,
  domains: string[],
): Promise<Map<string, string[]>> {
  const byDomain = new Map<string, string[]>()
  const unique = [...new Set(domains.map(normalizeDomain))]

  for (let start = 0; start < unique.length; start += BATCH_SIZE) {
    const batch = unique.slice(start, start + BATCH_SIZE)
    // Com duplicatas, 50 domínios podem passar de 50 itens: pagina pelo `next`.
    let page: number | undefined

    do {
      const response = await bitrix.listCrmItems(
        env.payments.spa.aplicationEntityType,
        {
          [BITRIX_SPA_CLIENT_FIELDS.APP_CODE]: appCodeId,
          [`@${BITRIX_SPA_CLIENT_FIELDS.DOMAIN}`]: batch,
        },
        {
          select: ['id', BITRIX_SPA_CLIENT_FIELDS.DOMAIN],
          ...(page !== undefined && { start: page }),
        },
      )

      for (const raw of response.result?.items ?? []) {
        const item = raw as Record<string, unknown>
        const rawDomain = item[BITRIX_SPA_CLIENT_FIELDS.DOMAIN]
        if (typeof rawDomain !== 'string') continue
        if (typeof item.id !== 'string' && typeof item.id !== 'number') continue

        const key = normalizeDomain(rawDomain)
        byDomain.set(key, [...(byDomain.get(key) ?? []), String(item.id)])
      }

      page = response.next
    } while (page !== undefined)
  }

  for (const [key, ids] of byDomain) {
    byDomain.set(
      key,
      ids.sort((left, right) => Number(left) - Number(right)),
    )
  }

  return byDomain
}
