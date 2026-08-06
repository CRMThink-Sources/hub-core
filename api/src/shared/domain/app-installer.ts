import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

/**
 * Tudo que um installer precisa saber sobre a instalação em curso.
 *
 * `spaItemId` é `string` e não `string | null` de propósito: o passo
 * `link-spa-item` roda antes de `run-installer` e é fail-fast, então quando um
 * installer executa o vínculo já existe. É o que permite o installer do ThinkZap
 * sincronizar as opções do robô sem reconsultar o banco.
 */
export interface AppInstallContext {
  /** Portal do **cliente**, autenticado com o `access_token` da instalação. */
  client: BitrixRestClient
  /** `core_app_codes.id`, no formato `crmthink.thinkzap`. */
  appCode: string
  /** `core_apps.id` da instalação já persistida. */
  installedAppId: string
  /** `core_apps.spa_id` — item espelho na SPA 1060, já vinculado. */
  spaItemId: string
  domain: string
  email: string
  memberId: string
}

/**
 * Contrato único do que uma aplicação registra no portal durante a instalação.
 *
 * Substitui o par `getBinds()` + `onInstall()` do registry antigo. A separação
 * existia porque os binds foram originalmente pensados para rodar no frontend
 * via `BX24.callMethod`; hoje o backend executa os dois, e com a instalação
 * fail-fast ambos podem derrubá-la — então não há mais o que distinguir.
 *
 * Uma implementação por aplicação, dentro do módulo daquela aplicação. Nenhum
 * passo específico de app vive no controller, no orquestrador ou no registry.
 */
export interface AppInstaller {
  /** `core_app_codes.id` que este installer atende. */
  readonly appCode: string
  install(context: AppInstallContext): Promise<void>
}
