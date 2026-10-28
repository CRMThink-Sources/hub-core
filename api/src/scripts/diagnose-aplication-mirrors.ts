import 'dotenv/config'

import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { normalizeDomain } from '@/modules/application/infra/bitrix/readers/find-aplication-spa-items'
import { BITRIX_SPA_CLIENT_FIELDS } from '@/shared/domain/config/bitrix.env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

/**
 * Diagnóstico **só leitura** da persistência das instalações: `core_apps` contra o
 * espelho na SPA 1060.
 *
 * Responde, com números, "a listagem de aplicações é confiável?":
 * - instalações por estado de espelho (`linked`, `no-mirror`, `mirror-missing`);
 * - itens da SPA 1060 que nenhuma instalação aponta, e se há instalação para o par
 *   (domínio, app code) deles — o caso que "Vincular espelho" resolve;
 * - pares (domínio, app code) com mais de um item na SPA;
 * - instalações por `status` de `core_apps`.
 *
 * Nada é escrito: só `prisma.app.findMany` e `crm.item.list`. Uso:
 * `yarn tsx src/scripts/diagnose-aplication-mirrors.ts [--json]`.
 */

type SpaItem = { id: string; title: string; domain: string; appCode: string }

const text = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''

const pairKey = (domain: string, appCode: string) =>
  `${normalizeDomain(domain)}|${appCode}`

async function listAllSpaItems(bitrix: BitrixClient): Promise<SpaItem[]> {
  const items: SpaItem[] = []
  let start: number | undefined

  do {
    const response = await bitrix.listCrmItems(
      env.payments.spa.aplicationEntityType,
      {},
      {
        select: [
          'id',
          'title',
          BITRIX_SPA_CLIENT_FIELDS.DOMAIN,
          BITRIX_SPA_CLIENT_FIELDS.APP_CODE,
        ],
        ...(start !== undefined && { start }),
      },
    )

    for (const raw of response.result?.items ?? []) {
      const record = raw as Record<string, unknown>
      items.push({
        id: text(record.id),
        title: text(record.title),
        domain: text(record[BITRIX_SPA_CLIENT_FIELDS.DOMAIN]),
        appCode: text(record[BITRIX_SPA_CLIENT_FIELDS.APP_CODE]),
      })
    }

    start = response.next
  } while (start !== undefined)

  return items
}

async function main() {
  const asJson = process.argv.slice(2).includes('--json')

  const apps = await prisma.app.findMany({
    select: {
      id: true,
      spaId: true,
      status: true,
      appCodeId: true,
      domain: { select: { name: true } },
    },
  })

  const bitrix = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const spaItems = await listAllSpaItems(bitrix)
  const spaIds = new Set(spaItems.map(item => item.id))

  const byMirror = { linked: 0, 'no-mirror': 0, 'mirror-missing': 0 }
  const mirrorMissing: Array<{ app: string; domain: string; spaId: string }> =
    []
  const noMirror: Array<{ app: string; domain: string; appCode: string }> = []
  const byStatus: Record<string, number> = {}

  for (const app of apps) {
    byStatus[app.status] = (byStatus[app.status] ?? 0) + 1

    if (app.spaId === null) {
      byMirror['no-mirror'] += 1
      noMirror.push({
        app: app.id,
        domain: app.domain.name,
        appCode: app.appCodeId,
      })
    } else if (spaIds.has(app.spaId)) {
      byMirror.linked += 1
    } else {
      byMirror['mirror-missing'] += 1
      mirrorMissing.push({
        app: app.id,
        domain: app.domain.name,
        spaId: app.spaId,
      })
    }
  }

  const linkedSpaIds = new Set(
    apps.map(app => app.spaId).filter((id): id is string => id !== null),
  )
  const appPairs = new Set(
    apps.map(app => pairKey(app.domain.name, app.appCodeId)),
  )

  const orphanItems = spaItems
    .filter(item => !linkedSpaIds.has(item.id))
    .map(item => ({
      ...item,
      // Há instalação para o par, só não vinculada a este item: "Vincular espelho"
      // (ou o backfill) resolve, se não houver duplicata.
      hasInstallation: appPairs.has(pairKey(item.domain, item.appCode)),
    }))

  const itemsByPair = new Map<string, SpaItem[]>()
  for (const item of spaItems) {
    const key = pairKey(item.domain, item.appCode)
    itemsByPair.set(key, [...(itemsByPair.get(key) ?? []), item])
  }
  const duplicates = [...itemsByPair.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([pair, items]) => ({
      pair,
      ids: items.map(item => item.id).join(', '),
    }))

  const report = {
    generatedAt: new Date().toISOString(),
    totals: { installations: apps.length, spaItems: spaItems.length },
    installationsByMirror: byMirror,
    installationsByStatus: byStatus,
    orphanSpaItems: {
      total: orphanItems.length,
      withInstallation: orphanItems.filter(item => item.hasInstallation).length,
      withoutInstallation: orphanItems.filter(item => !item.hasInstallation)
        .length,
    },
    duplicatePairs: duplicates.length,
    details: { noMirror, mirrorMissing, orphanItems, duplicates },
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log(`Diagnóstico de espelhos — ${report.generatedAt}\n`)
  console.table(report.totals)
  console.log('Instalações por estado de espelho:')
  console.table(byMirror)
  console.log('Instalações por status (core_apps):')
  console.table(byStatus)
  console.log('Itens da SPA 1060 sem instalação vinculada:')
  console.table(report.orphanSpaItems)
  console.log(
    `Pares (domínio, app code) duplicados na SPA: ${duplicates.length}`,
  )
  if (duplicates.length > 0) console.table(duplicates)
  if (mirrorMissing.length > 0) {
    console.log('Instalações com espelho apagado:')
    console.table(mirrorMissing)
  }
  if (noMirror.length > 0) {
    console.log('Instalações sem espelho:')
    console.table(noMirror)
  }
}

main()
  .catch(error => {
    console.error('Falha no diagnóstico de espelhos:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
