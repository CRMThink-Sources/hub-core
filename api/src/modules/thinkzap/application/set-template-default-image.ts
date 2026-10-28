import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import { TemplateSampleImageFetcher } from '@/modules/thinkzap/domain/ports/template-sample-image-fetcher.port'
import {
  TemplateImageStorage,
  TemplateImageStorageUnavailableError,
} from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import { TemplateDefaultsRepository } from '@/modules/thinkzap/domain/ports/template-defaults-repository.port'
import { TemplateNotFoundError } from '@/modules/thinkzap/domain/ports/template-errors'
import { templateHeaderOf } from '@/modules/thinkzap/domain/template-header'
import {
  resolveTemplateContext,
  type ResolveTemplateContextInput,
} from './helpers/resolve-template-context'
import {
  assertImageUrl,
  imageFromFile,
  InvalidTemplateHeaderImageError,
} from './helpers/template-definition'

export type SetTemplateDefaultImageInput = ResolveTemplateContextInput & {
  name: string
  language: string
  /** Exatamente uma das duas fontes. */
  imageUrl?: string
  imageFile?: { data: Buffer }
}

/**
 * Define ou troca a imagem padrão do envio de um template com cabeçalho de imagem —
 * inclusive de template criado direto na Meta, que nunca passou pelo ThinkZap.
 *
 * A imagem passa pelas mesmas travas da amostra do cadastro: link `https` público,
 * fora do CDN da Meta (expira), JPEG/PNG de até 5 MB. O arquivo vai para o bucket
 * sem expiração.
 *
 * A imagem anterior **não** é apagada: um envio na fila pode estar reenviando com
 * ela.
 */
export class SetTemplateDefaultImageUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly templateProviderResolver: TemplateProviderResolver,
    private readonly sampleImageFetcher: TemplateSampleImageFetcher,
    private readonly imageStorage: TemplateImageStorage | null,
    private readonly templateDefaults: TemplateDefaultsRepository,
  ) {}

  async execute(
    input: SetTemplateDefaultImageInput,
  ): Promise<{ headerImageUrl: string }> {
    const imageUrl = input.imageUrl?.trim()
    if (Boolean(imageUrl) === Boolean(input.imageFile)) {
      throw new InvalidTemplateHeaderImageError(
        'Envie o arquivo da imagem padrão ou informe o link, não os dois',
      )
    }

    const image = input.imageFile
      ? imageFromFile(input.imageFile.data, 'default')
      : undefined
    if (imageUrl) {
      await assertImageUrl(this.sampleImageFetcher, imageUrl, 'default')
    }
    if (image && !this.imageStorage) {
      throw new TemplateImageStorageUnavailableError('bucket não configurado')
    }

    // Gravação local, mas linha bloqueada também recusa: é escrita do cliente.
    const { wabaId, provider } = await resolveTemplateContext(
      input,
      {
        getAplicationContext: this.getAplicationContext,
        templateProviderResolver: this.templateProviderResolver,
      },
      { requireEnabled: true },
    )

    const template = (await provider.listTemplates(wabaId)).find(
      t => t.name === input.name && t.language === input.language,
    )
    if (!template) {
      throw new TemplateNotFoundError(`${input.name} (${input.language})`)
    }
    if (templateHeaderOf(template.components) !== 'IMAGE') {
      throw new InvalidTemplateHeaderImageError(
        'Este template não tem cabeçalho de imagem',
      )
    }

    const headerImageUrl =
      image && this.imageStorage
        ? (
            await this.imageStorage.store({
              data: image.data,
              contentType: image.contentType,
              scope: { domainId: input.domainId },
              retention: 'permanent',
            })
          ).url
        : (imageUrl as string)

    await this.templateDefaults.upsert(
      {
        domainId: input.domainId,
        subscriptionItemId: input.subscriptionItemId,
      },
      { name: input.name, language: input.language, headerImageUrl },
    )
    return { headerImageUrl }
  }
}
