import type { NoticeLocale } from '@/modules/thinkzap/domain/daily-limit-notices'

/**
 * Idioma escolhido no app, por instalação (`core_apps.locale`).
 *
 * As leituras **nunca lançam**: são chamadas na hora de avisar sobre um envio que já
 * foi decidido, e um banco indisponível não pode transformar o aviso em job falho.
 * Falha ou instalação sem escolha resolvem português.
 */
export interface InstallationLocaleRepository {
  /** Por `core_apps.id`. */
  byAppId(appId: string): Promise<NoticeLocale>
  /** Pelo par do JWT/outbox: `domainId` + `appCodeId`. */
  byInstallation(domainId: string, appCodeId: string): Promise<NoticeLocale>
  /** `false` = instalação não encontrada. */
  save(
    domainId: string,
    appCodeId: string,
    locale: NoticeLocale,
  ): Promise<boolean>
}
