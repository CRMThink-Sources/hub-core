import 'dotenv/config'

import { prisma } from '@/config/prisma.js'
import { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'
import { buildConnectorRegisterParams } from '@/modules/thinkzap/install/build-connector-register-params'

/**
 * Re-registra o conector nas instalações existentes.
 *
 * `imconnector.register` declara ao Bitrix **o que o conector sabe fazer**, e a
 * declaração fica gravada no portal no momento da instalação. Mudar o código não
 * alcança quem já instalou: o installer só roda na instalação. Este script é o
 * caminho.
 *
 * O motivo imediato é `DEL_INTERNAL_MESSAGES`, que estava `'N'` desde sempre e fazia
 * o Bitrix **recusar** a exclusão de mensagem do operador — a mensagem sumia da tela,
 * o servidor revertia, e nenhum evento era emitido. Enquanto este script não rodar,
 * as instalações antigas continuam nesse estado.
 *
 * **Re-registrar atualiza, não duplica.** A documentação do Bitrix: *"If the method
 * is called again with the same ID, the method updates the current connector."* Não
 * há método de update separado, e não é preciso desregistrar.
 *
 * **O corpo vai inteiro**, de `buildConnectorRegisterParams` — a mesma função que a
 * instalação usa. Mandar só o campo que mudou arriscaria zerar ícone, nome e
 * `PLACEMENT_HANDLER`: a chamada é uma atualização do conector, e a documentação não
 * garante preservar campo omitido.
 *
 * Escreve só com `--apply`. Sem a flag é relatório — o default seguro é não tocar no
 * portal de ninguém.
 *
 * **Idempotente:** re-registrar com o mesmo corpo não tem efeito além de reescrever
 * os mesmos valores, então re-rodar é inofensivo.
 *
 * **Falha de uma instalação não para as outras.** Token expirado é o caso comum, e é
 * dela — abortar o lote deixaria as seguintes sem o conserto por causa de um problema
 * que não é delas. Cada falha entra no relatório e no código de saída.
 *
 * **Serve aos dois sentidos.** O rollback desta mudança é reverter os commits **e**
 * rodar este script de novo, que aí re-registra com o flag desligado. Reverter só o
 * código deixaria o Bitrix aceitando exclusões que ninguém processa — o pior dos dois
 * estados.
 */
const APPLY = process.argv.includes('--apply')

type Outcome = 'registered' | 'skipped-no-credential' | 'failed'

type Row = {
  domain: string
  outcome: Outcome
  detail?: string
}

async function main(): Promise<void> {
  const params = buildConnectorRegisterParams()

  const apps = await prisma.app.findMany({
    where: { appCodeId: thinkzapAppCodeId() },
    include: { credential: true, domain: true },
  })

  console.log(
    `${apps.length} instalação(ões) do ThinkZap. Modo: ${
      APPLY ? 'APLICANDO' : 'relatório (use --apply para escrever)'
    }`,
  )
  console.log(
    `conector: ${String(params.ID)} · ` +
      `DEL_INTERNAL_MESSAGES=${String(params.DEL_INTERNAL_MESSAGES)} · ` +
      `EDIT_INTERNAL_MESSAGES=${String(params.EDIT_INTERNAL_MESSAGES)} · ` +
      `DEL_EXTERNAL_MESSAGES=${String(params.DEL_EXTERNAL_MESSAGES)}\n`,
  )

  /**
   * Guarda antes do lote: `PLACEMENT_HANDLER` vazio sobrescreveria o handler de todas
   * as instalações com string vazia, e o conector pararia de abrir. Falhar aqui é
   * melhor que descobrir depois de escrever na base inteira.
   */
  if (!params.PLACEMENT_HANDLER) {
    console.error(
      'BITRIX_CONNECTOR_URL vazio: re-registrar assim apagaria o PLACEMENT_HANDLER ' +
        'de todas as instalações. Configure a variável antes de rodar.',
    )
    process.exitCode = 1
    await prisma.$disconnect()
    return
  }

  const rows: Row[] = []

  for (const app of apps) {
    const domain = app.domain.name

    /**
     * Sem token não há como chamar o portal. Não é erro do script: instalação
     * desinstalada ou com credencial revogada não tem conector ativo a atualizar.
     */
    if (!app.credential?.accessToken) {
      rows.push({ domain, outcome: 'skipped-no-credential' })
      continue
    }

    if (!APPLY) {
      rows.push({
        domain,
        outcome: 'registered',
        detail: 'seria re-registrado',
      })
      continue
    }

    try {
      const client = new BitrixRestClient(domain, app.credential.accessToken)

      await client.callMethod('imconnector.register', params)

      rows.push({ domain, outcome: 'registered' })
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
    `\nre-registradas: ${by('registered').length} · ` +
      `sem credencial: ${by('skipped-no-credential').length} · ` +
      `falhas: ${by('failed').length}`,
  )

  /**
   * Falha entra no código de saída para o operador não achar que terminou. As
   * instalações que falharam continuam recusando a exclusão, e re-rodar é o caminho.
   */
  if (by('failed').length > 0) process.exitCode = 1
}

void main()
