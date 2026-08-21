import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import dotenv from 'dotenv'

/**
 * Entrypoint do backfill de cobrança a partir do gateway. **Não importa nada do
 * projeto**, e essa é a única razão de ele existir separado do corpo em
 * `backfill-stripe-subscriptions-to-spa.run.ts`.
 *
 * `@/config/prisma` monta o adapter lendo `process.env.DATABASE_HOST` **no load do
 * módulo**, e `@/config/env` congela o objeto `env` no import. Como `import` é
 * içado, qualquer import estático de um dos dois aconteceria antes do
 * `dotenv.config()` daqui — e o script rodaria contra o banco local achando que está
 * em produção, ou pior: leria a carteira de produção no Stripe e escreveria na SPA
 * de desenvolvimento, que vem de `CRMTHINK_WEBHOOK_URL`, do mesmo arquivo.
 *
 * Por isso o corpo entra por `await import()` dinâmico, depois do dotenv.
 *
 * Uso:
 *   yarn backfill:stripe-subscriptions-to-spa --env-file .env.production
 *   yarn backfill:stripe-subscriptions-to-spa --env-file .env.production --apply
 *   yarn backfill:stripe-subscriptions-to-spa --env-file .env.production --price price_xxx
 */

function parseEnvFile(argv: string[]): string | null {
  const index = argv.indexOf('--env-file')
  if (index === -1) return null

  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    console.error('--env-file exige um caminho: --env-file .env.production')
    process.exit(1)
  }

  return value
}

async function main() {
  const envFile = parseEnvFile(process.argv.slice(2))

  if (envFile) {
    const path = resolve(process.cwd(), envFile)

    /**
     * Arquivo inexistente aborta em vez de seguir com o env do ambiente: seguir
     * seria rodar contra o banco errado com a mensagem "carregado" na tela.
     */
    if (!existsSync(path)) {
      console.error(`Arquivo de env não encontrado: ${path}`)
      process.exit(1)
    }

    /**
     * `override: true` porque a shell pode já ter `DATABASE_HOST` exportado de outro
     * ambiente, e o arquivo pedido explicitamente tem que ganhar dele.
     */
    dotenv.config({ path, override: true })
    console.log(`Env carregado de ${path}`)
  } else {
    // Sem a flag, o comportamento é o dos outros scripts do repo: env do processo.
    dotenv.config()
  }

  await import('./backfill-stripe-subscriptions-to-spa.run')
}

main().catch(error => {
  console.error('Falha ao iniciar o backfill:', error)
  process.exit(1)
})
