import 'dotenv/config'

import Stripe from 'stripe'
import { env } from '@/config/env'

/**
 * Confere o endpoint de webhook cadastrado no gateway.
 *
 * **Por que existe:** é a última configuração desta feature cujo erro é silencioso.
 * Endpoint não cadastrado, URL errada, ou faltando um dos três eventos produzem o
 * mesmo sintoma — "paguei e a linha não voltou" — sem nenhum erro do nosso lado,
 * porque o evento simplesmente nunca chega. O gateway reentrega por 3 dias contra
 * uma URL que não existe e desiste.
 *
 * O que **não** dá para verificar por aqui: se o `STRIPE_WEBHOOK_SECRET` do `.env` é
 * o deste endpoint. O gateway devolve o segredo só na criação. Se a assinatura
 * estiver sendo recusada com o endpoint correto e os eventos certos, o segredo
 * trocado é o suspeito — e é o que o log do endpoint diz, em `warn`.
 *
 * Só leitura — não cria nem altera endpoint.
 */

/** Os três eventos que o handler trata. Qualquer outro é ignorado com log. */
const REQUIRED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]

const WEBHOOK_PATH = '/webhooks/stripe'

async function main() {
  if (!env.payments.stripe.secretKey) {
    console.error('STRIPE_SECRET_KEY está vazio.')
    process.exit(1)
  }

  /** `env.apiUrl` já termina em `/api`, e a rota é `/api/webhooks/stripe`. */
  const expectedUrl = `${env.apiUrl}${WEBHOOK_PATH}`

  /**
   * Rodando local, `API_URL` é `localhost` — que o gateway **não alcança**. Sem
   * distinguir esse caso o script falharia sempre em máquina de dev, e um script que
   * sempre falha para de ser lido justamente quando o problema for real.
   */
  const unreachable = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(
    expectedUrl,
  )

  console.log(`URL esperada (API_URL local): ${expectedUrl}`)
  if (unreachable) {
    console.log(
      '  ^ o gateway não alcança este host. Conferindo, então, todos os endpoints\n' +
        '    cadastrados com o caminho certo — é o que vale para staging e produção.',
    )
  }
  console.log(
    `STRIPE_WEBHOOK_SECRET: ${env.payments.stripe.webhookSecret ? 'configurado' : '(VAZIO — todo evento é recusado)'}\n`,
  )

  const stripe = new Stripe(env.payments.stripe.secretKey)
  const { data: endpoints } = await stripe.webhookEndpoints.list({ limit: 100 })

  if (endpoints.length === 0) {
    console.log('Nenhum endpoint de webhook cadastrado no gateway.')
    console.log(
      `\nCadastre ${expectedUrl} com os eventos:\n  ${REQUIRED_EVENTS.join('\n  ')}`,
    )
    process.exit(1)
  }

  console.log(`Endpoints cadastrados: ${endpoints.length}`)
  for (const endpoint of endpoints) {
    const mine = endpoint.url === expectedUrl
    console.log(
      `  ${endpoint.url}  [${endpoint.status}]${mine ? '  <== ESPERADO' : ''}`,
    )
  }

  /**
   * Os candidatos: o do `API_URL` exato quando ele é alcançável, senão todos os que
   * têm o caminho certo. Endpoint com **outro** caminho não serve — e o legado
   * `/stripe/webhook` da cobrança antiga é exatamente esse caso.
   */
  const candidates = unreachable
    ? endpoints.filter(endpoint => endpoint.url.endsWith(WEBHOOK_PATH))
    : endpoints.filter(endpoint => endpoint.url === expectedUrl)

  const legacy = endpoints.filter(
    endpoint => !endpoint.url.endsWith(WEBHOOK_PATH),
  )

  console.log('')
  if (candidates.length === 0) {
    console.log(
      `FALHOU: nenhum endpoint com o caminho ${WEBHOOK_PATH}. Os eventos nunca chegam, ` +
        'e a ativação depende do `checkout.session.completed`.',
    )
    console.log(
      `\nCadastre <sua-api>${WEBHOOK_PATH} com os eventos:\n  ${REQUIRED_EVENTS.join('\n  ')}`,
    )
    process.exit(1)
  }

  const problems: string[] = []

  for (const endpoint of candidates) {
    console.log(`--- ${endpoint.url}`)
    console.log(`    status: ${endpoint.status}`)

    /** `*` cobre tudo, inclusive os três — o handler ignora o resto com log. */
    const events = endpoint.enabled_events
    const listensToAll = events.includes('*')
    const missing = listensToAll
      ? []
      : REQUIRED_EVENTS.filter(event => !events.includes(event))

    console.log(
      `    eventos: ${listensToAll ? '* (todos)' : events.join(', ') || '(nenhum)'}`,
    )

    if (endpoint.status !== 'enabled') {
      problems.push(
        `${endpoint.url}: status "${endpoint.status}" — endpoint desabilitado não recebe nada`,
      )
    }
    if (missing.length > 0) {
      problems.push(`${endpoint.url}: faltam os eventos ${missing.join(', ')}`)
    }
  }

  if (legacy.length > 0) {
    console.log(
      '\nEndpoints com outro caminho (não servem a esta rota — provavelmente legado):',
    )
    for (const endpoint of legacy) {
      console.log(`  ${endpoint.url}  [${endpoint.status}]`)
    }
  }

  console.log('')
  if (problems.length > 0) {
    console.log(`${problems.length} problema(s):`)
    for (const problem of problems) console.log(`  - ${problem}`)
    process.exit(1)
  }

  console.log(
    'OK: endpoint cadastrado, habilitado, e ouvindo os três eventos.\n' +
      'O segredo em si não é verificável por API — se a assinatura for recusada com ' +
      'isto tudo certo, o `whsec_` do .env é de outro endpoint.',
  )
}

main().catch(error => {
  console.error('Falha ao conferir o webhook no gateway:', error)
  process.exit(1)
})
