import { isHttpsUrl } from '@/modules/thinkzap/domain/template-header'
import { apiLogger } from '@/shared/infra/logger'
import type { RobotTemplateIdentity } from './resolve-robot-template-body'

/** O que a listagem de templates da linha devolve, do que aqui interessa. */
export type TemplateHeaderLookup = (input: {
  subscriptionItemId: string
  domainId: string
  appCode: string
}) => Promise<{ name: string; language: string; header?: { type: string } }[]>

export type ResolveRobotHeaderImageInput = RobotTemplateIdentity & {
  subscriptionItemId: string
  domainId: string
  appCode: string
  /** Valor da propriedade, já com o campo do documento resolvido pelo Bitrix. */
  value: string
}

/** O template exige imagem e o robô não trouxe uma URL `https`. */
export type MissingHeaderImage = { missing: true }

/**
 * A imagem do cabeçalho de uma execução do robô.
 *
 * O catálogo decide se o template tem imagem: o Bitrix entrega o campo do documento
 * já resolvido, e campo vazio é indistinguível de robô antigo sem a propriedade. A
 * consulta é a mesma do corpo e dos botões (memoizada no handler).
 *
 * Template sem imagem ignora o valor — mandar `HEADER` para ele faria a Meta recusar.
 * Falha do catálogo não bloqueia: com URL `https` ela vai; sem URL o envio sai sem
 * imagem, e se o template exigia uma a recusa chega pela Meta, como antes desta
 * propriedade existir.
 */
export async function resolveRobotHeaderImage(
  input: ResolveRobotHeaderImageInput,
  lookup: TemplateHeaderLookup,
): Promise<{ headerImageUrl?: string } | MissingHeaderImage> {
  const value = input.value.trim()

  let headerType: string | undefined
  try {
    const templates = await lookup({
      subscriptionItemId: input.subscriptionItemId,
      domainId: input.domainId,
      appCode: input.appCode,
    })
    headerType = templates.find(
      candidate =>
        candidate.name === input.name && candidate.language === input.language,
    )?.header?.type
  } catch (error) {
    apiLogger.warn(
      { app: 'thinkzap', source: 'bitrix', err: (error as Error).message },
      'catálogo indisponível ao resolver a imagem do cabeçalho do robô',
    )
    return isHttpsUrl(value) ? { headerImageUrl: value } : {}
  }

  if (headerType !== 'IMAGE') return {}
  return isHttpsUrl(value) ? { headerImageUrl: value } : { missing: true }
}
