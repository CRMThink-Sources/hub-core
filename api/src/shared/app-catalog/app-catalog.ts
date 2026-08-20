import { env } from '@/config/env'

/**
 * **Fonte de verdade única de "qual app é esta e para onde ela abre".**
 *
 * Antes desta tabela a resposta vivia em três lugares: `appIdResolver` aqui no
 * api, `DEFAULT_APP_REDIRECTS` e `envConfig.appCodes` no front. O front agora
 * recebe a identidade resolvida na resposta de `POST /api/auth` e não decide
 * nada — ver spec `app-login-identity`.
 */
export type AppCatalogEntry = {
  /** Code canônico da app (`core_app_codes.code`). Estável, não vem de env. */
  appCode: string
  /**
   * Valor gravado em `appCodeId` no JWT e usado como chave de
   * `core_app_codes`. Hoje é igual ao `appCode` — a PK da tabela é a própria
   * string do code. Nomeado separadamente porque são conceitos distintos: um é
   * identidade da app, o outro é chave de linha.
   */
  appCodeId: string
  /** Segmento de rota de entrada da app no front (sem barra). */
  slug: string
  /**
   * Se `true`, o cliente registra o refresh token do operador em
   * `POST /api/auth/bitrix-oauth` depois do login. Substitui a condicional por
   * nome de app que existia no front.
   */
  requiresOperatorOAuth: boolean
}

type AppCatalogDefinition = AppCatalogEntry & {
  /**
   * Code que o Bitrix devolve em `app.info` — configurável por ambiente porque
   * a app publicada no marketplace pode ter code diferente do canônico
   * (instalação de teste, por exemplo).
   */
  marketplaceCode: string
}

const DEFINITIONS: readonly AppCatalogDefinition[] = [
  {
    marketplaceCode: env.appCodes.thinkzap,
    appCode: 'crmthink.thinkzap',
    appCodeId: 'crmthink.thinkzap',
    slug: 'thinkzap',
    // Só o thinkzap envia mensagem em nome do operador, então só ele precisa
    // do refresh token dele.
    requiresOperatorOAuth: true,
  },
  {
    marketplaceCode: env.appCodes.thinkanalise,
    appCode: 'crmthink.thinkanalise',
    appCodeId: 'crmthink.thinkanalise',
    slug: 'thinkanalise',
    requiresOperatorOAuth: false,
  },
  {
    marketplaceCode: env.appCodes.importsheet,
    appCode: 'crmthink.importsheet',
    appCodeId: 'crmthink.importsheet',
    slug: 'importsheet',
    requiresOperatorOAuth: false,
  },
  {
    marketplaceCode: env.appCodes.clicksign,
    appCode: 'crmthink.clicksign',
    appCodeId: 'crmthink.clicksign',
    slug: 'clicksign',
    requiresOperatorOAuth: false,
  },
]

const toEntry = ({
  marketplaceCode: _marketplaceCode,
  ...entry
}: AppCatalogDefinition): AppCatalogEntry => entry

/**
 * Índice de entrada do login. Aceita o code do marketplace **e** o canônico:
 * quando a env não está sobrescrita os dois coincidem, e quando está, o
 * canônico continua sendo uma entrada válida.
 *
 * Code vazio nunca entra no índice — `env.appCodes.*` cai para o canônico, mas
 * um mapa indexado por string vazia é o tipo de armadilha que fazia o front
 * resolver `undefined` em silêncio.
 */
const byInputCode = new Map<string, AppCatalogEntry>()
const byAppCode = new Map<string, AppCatalogEntry>()

for (const definition of DEFINITIONS) {
  const entry = toEntry(definition)
  byAppCode.set(entry.appCode, entry)
  for (const code of [definition.marketplaceCode, definition.appCode]) {
    if (code) byInputCode.set(code, entry)
  }
}

/** Resolve pelo code que o Bitrix devolveu em `app.info`. */
export const resolveByMarketplaceCode = (
  code: string | undefined | null,
): AppCatalogEntry | null => (code ? (byInputCode.get(code) ?? null) : null)

/** Resolve pelo code canônico da app. */
export const resolveByAppCode = (
  appCode: string | undefined | null,
): AppCatalogEntry | null => (appCode ? (byAppCode.get(appCode) ?? null) : null)

/** Todas as apps do catálogo, na ordem de declaração. */
export const listAppCatalog = (): readonly AppCatalogEntry[] =>
  DEFINITIONS.map(toEntry)

/**
 * `appCodeId` do thinkzap — o code **canônico**, que é o que `core_app_codes.id`
 * guarda e o que `GetAplicationContext`, `getByAppCodeAndDomainId` e
 * `availableAppRepo.getById` esperam.
 *
 * Existe porque `env.appCodes.thinkzap` é o code **do marketplace**, que em
 * instalação local vira algo como `local.6a070b9ee9dfb9.18692076`. Passar um no
 * lugar do outro compila e só falha em runtime, com "Aplicação não encontrada" —
 * confundir os dois já custou duas regressões, e o nome aqui é o que evita a
 * terceira.
 */
export const thinkzapAppCodeId = (): string =>
  resolveByMarketplaceCode(env.appCodes.thinkzap)?.appCodeId ??
  'crmthink.thinkzap'
