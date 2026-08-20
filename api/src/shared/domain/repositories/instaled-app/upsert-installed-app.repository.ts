import { InstalledApp } from '@/shared/domain/entities/installed-app'

export type UpsertInstalledAppParams = {
  domainId: string
  appCodeId: string
  email: string
}

/**
 * Escrita idempotente de `core_apps` no fluxo de instalação, sobre a restrição
 * única `(domain_id, app_code_id)`.
 *
 * No update grava `email` e devolve `status` para `ACTIVE` — reinstalar um app
 * desinstalado tem que reativar a linha, não criar outra. `core_apps.id` é
 * preservado, então conectores, saldos e assinaturas já associados continuam
 * válidos.
 */
export interface UpsertInstalledAppRepository {
  upsert(params: UpsertInstalledAppParams): Promise<InstalledApp>
}
