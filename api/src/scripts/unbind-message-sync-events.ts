import 'dotenv/config'

import { prisma } from '@/config/prisma.js'
import { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'

/**
 * Remove os binds de `ONIMCONNECTORMESSAGEUPDATE` e `ONIMCONNECTORMESSAGEDELETE` das
 * instalações existentes.
 *
 * As sincronizações de edição e exclusão de mensagem foram descontinuadas. O código
 * já parou de registrar os eventos em instalações novas e o roteamento descarta o que
 * chega — mas **parar de tratar não para de receber**: enquanto os binds existirem no
 * portal do cliente, cada edição ou exclusão no CRM vira um webhook para nós. Este
 * script fecha isso.
 *
 * Escreve só com `--apply`. Sem a flag é relatório — o default seguro é não tocar no
 * portal de ninguém.
 *
 * **Idempotente:** `event.unbind` de evento que já não está registrado responde sem
 * efeito, então re-rodar é inofensivo. É o que permite rodar em lote sem saber quais
 * instalações já foram.
 *
 * **Falha de uma instalação não para as outras.** Token expirado é o caso comum, e é
 * dela — abortar o lote inteiro por causa disso deixaria as seguintes recebendo
 * evento por causa de um problema que não é delas. Cada falha entra no relatório.
 */
const APPLY = process.argv.includes('--apply')

const EVENTS = [
  'ONIMCONNECTORMESSAGEUPDATE',
  'ONIMCONNECTORMESSAGEDELETE',
] as const

type Outcome = 'unbound' | 'skipped-no-credential' | 'failed'

type Row = {
  domain: string
  outcome: Outcome
  detail?: string
}

async function main(): Promise<void> {
  const apps = await prisma.app.findMany({
    where: { appCodeId: thinkzapAppCodeId() },
    include: { credential: true, domain: true },
  })

  console.log(
    `${apps.length} instalação(ões) do ThinkZap. Modo: ${
      APPLY ? 'APLICANDO' : 'relatório (use --apply para escrever)'
    }\n`,
  )

  const rows: Row[] = []

  for (const app of apps) {
    const domain = app.domain.name

    /**
     * Sem token não há como chamar o portal. Não é erro do script: instalação
     * desinstalada ou com credencial revogada não tem bind ativo para nos entregar
     * evento de qualquer forma.
     */
    if (!app.credential?.accessToken) {
      rows.push({ domain, outcome: 'skipped-no-credential' })
      continue
    }

    if (!APPLY) {
      rows.push({ domain, outcome: 'unbound', detail: 'seria desbindado' })
      continue
    }

    try {
      const client = new BitrixRestClient(domain, app.credential.accessToken)

      /**
       * Em sequência, não em paralelo: são chamadas ao portal do cliente, e duas de
       * uma vez não ganham nada além de dobrar a chance de esbarrar em rate limit.
       */
      for (const event of EVENTS) {
        await client.callMethod('event.unbind', { event })
      }

      rows.push({ domain, outcome: 'unbound' })
    } catch (error) {
      rows.push({
        domain,
        outcome: 'failed',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }

  report(rows)

  await prisma.$disconnect()
}

function report(rows: Row[]): void {
  const by = (outcome: Outcome) => rows.filter(row => row.outcome === outcome)

  for (const row of rows) {
    const suffix = row.detail ? ` — ${row.detail}` : ''
    console.log(`  ${row.outcome.padEnd(22)} ${row.domain}${suffix}`)
  }

  console.log(
    `\ndesbindadas: ${by('unbound').length} · ` +
      `sem credencial: ${by('skipped-no-credential').length} · ` +
      `falhas: ${by('failed').length}`,
  )

  /**
   * Falha entra no código de saída para o operador não achar que terminou. As
   * instalações que falharam continuam entregando o evento, e re-rodar é o caminho.
   */
  if (by('failed').length > 0) process.exitCode = 1
}

void main()
