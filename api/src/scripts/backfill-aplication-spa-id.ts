import 'dotenv/config'

import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { PrismaAplicationRepository } from '@/modules/application/infra/prisma/repositories/prisma-aplications.repository'
import { BitrixAplicationTitleReader } from '@/modules/application/infra/bitrix/readers/bitrix-aplication-title.reader'
import { BITRIX_SPA_CLIENT_FIELDS } from '@/shared/domain/config/bitrix.env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

/**
 * Preenche `core_apps.spa_id` das instalações criadas antes da coluna existir,
 * resolvendo o item espelho na SPA 1060 pelo par (domínio, app code).
 *
 * Idempotente: processa só as instalações com `spa_id` nulo, então pode rodar de
 * novo depois de corrigir divergências no CRM à mão.
 *
 * Usa `BITRIX_SPA_CLIENT_FIELDS` (o vocabulário do onboarding) de propósito: é a
 * mesma SPA, e `payments` não guarda mais um mapa de campos próprio dela.
 */

/** Igual ao limite da listagem do Bitrix: o filtro por domínio vai em lotes. */
const BATCH_SIZE = 50

const normalizeDomain = (domain: string) => domain.trim().toLowerCase()

type PendingApp = {
  id: string
  /**
   * `appCodeId` (`crmthink.thinkzap`) é o que o install grava no `APP_CODE` do
   * item da SPA — `appCode.code` é o id do marketplace e não casaria.
   */
  appCodeId: string
  domain: { name: string }
}

type SpaItem = { id: unknown; [field: string]: unknown }

function parseArgs(): { dryRun: boolean } {
  return { dryRun: process.argv.slice(2).includes('--dry-run') }
}

/** Menor id primeiro: o item mais antigo é o que o install original criou. */
function pickOldest(items: SpaItem[]): string {
  const ids = items.map(item => String(item.id))

  return ids.sort((left, right) => Number(left) - Number(right))[0] as string
}

async function findSpaItemsByAppCode(
  bitrix: BitrixClient,
  appCode: string,
  domains: string[],
): Promise<Map<string, SpaItem[]>> {
  const byDomain = new Map<string, SpaItem[]>()

  for (let start = 0; start < domains.length; start += BATCH_SIZE) {
    const batch = domains.slice(start, start + BATCH_SIZE)

    const response = await bitrix.listCrmItems(
      env.payments.spa.aplicationEntityType,
      {
        [BITRIX_SPA_CLIENT_FIELDS.APP_CODE]: appCode,
        [`@${BITRIX_SPA_CLIENT_FIELDS.DOMAIN}`]: batch,
      },
      { select: ['id', BITRIX_SPA_CLIENT_FIELDS.DOMAIN] },
    )

    for (const raw of response.result?.items ?? []) {
      const item = raw as SpaItem
      const rawDomain = item[BITRIX_SPA_CLIENT_FIELDS.DOMAIN]
      if (typeof rawDomain !== 'string') continue

      const key = normalizeDomain(rawDomain)
      byDomain.set(key, [...(byDomain.get(key) ?? []), item])
    }
  }

  return byDomain
}

async function main() {
  const { dryRun } = parseArgs()

  const pending = (await prisma.app.findMany({
    where: { spaId: null },
    include: { domain: true },
  })) as unknown as PendingApp[]

  if (pending.length === 0) {
    console.log('Nada a fazer: nenhuma instalação com spa_id nulo.')
    return
  }

  const bitrix = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const aplications = new PrismaAplicationRepository(
    prisma,
    new BitrixAplicationTitleReader(bitrix),
  )

  const byAppCode = new Map<string, PendingApp[]>()
  for (const app of pending) {
    const code = app.appCodeId
    byAppCode.set(code, [...(byAppCode.get(code) ?? []), app])
  }

  let linked = 0
  let unresolved = 0
  let duplicated = 0
  let conflicts = 0

  for (const [appCode, apps] of byAppCode) {
    const domains = [
      ...new Set(apps.map(app => normalizeDomain(app.domain.name))),
    ]
    const itemsByDomain = await findSpaItemsByAppCode(bitrix, appCode, domains)

    for (const app of apps) {
      const items = itemsByDomain.get(normalizeDomain(app.domain.name)) ?? []

      if (items.length === 0) {
        unresolved += 1
        console.warn(
          `[não resolvido] ${app.domain.name} + ${appCode} (app ${app.id}): nenhum item na SPA`,
        )
        continue
      }

      if (items.length > 1) {
        duplicated += 1
        console.warn(
          `[duplicado] ${app.domain.name} + ${appCode}: itens ${items
            .map(item => String(item.id))
            .join(', ')} — usando o menor id`,
        )
      }

      const spaId = pickOldest(items)

      if (dryRun) {
        linked += 1
        console.log(
          `[dry-run] ${app.domain.name} + ${appCode} → item ${spaId} (app ${app.id})`,
        )
        continue
      }

      try {
        await aplications.linkSpaItem(app.id, spaId)
        linked += 1
        console.log(`[vinculado] ${app.domain.name} + ${appCode} → ${spaId}`)
      } catch (error) {
        // Item já vinculado a outra instalação (violação da restrição única) não
        // aborta o script: as demais instalações continuam resolvíveis.
        conflicts += 1
        console.error(
          `[conflito] ${app.domain.name} + ${appCode} → ${spaId}:`,
          error instanceof Error ? error.message : error,
        )
      }
    }
  }

  console.log(
    `\nResumo${dryRun ? ' (dry-run)' : ''}: ${linked} vinculado(s), ` +
      `${unresolved} não resolvido(s), ${duplicated} duplicado(s), ` +
      `${conflicts} conflito(s), de ${pending.length} pendente(s).`,
  )
}

// Não resolvido é esperado (item apagado no CRM, portal migrado), então não vira
// código de saída diferente de zero — o resumo é o relatório.
main()
  .catch(error => {
    console.error('Falha no backfill de spa_id:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
