import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import {
  Template,
  TemplateCategory,
  TemplateComponent,
} from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { TemplateSampleImageFetcher } from '@/modules/thinkzap/domain/ports/template-sample-image-fetcher.port'
import type { TemplateImageStorage } from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import type {
  TemplateDefaultsRepository,
  TemplateDefaultsScope,
} from '@/modules/thinkzap/domain/ports/template-defaults-repository.port'
import { TemplateNotFoundError } from '@/modules/thinkzap/domain/ports/template-errors'
import {
  headerImageExampleOf,
  templateHeaderOf,
} from '@/modules/thinkzap/domain/template-header'
import { apiLogger } from '@/shared/infra/logger'
import {
  resolveTemplateContext,
  type ResolveTemplateContextInput,
} from './helpers/resolve-template-context'
import {
  assertSampleImage,
  imageFromFile,
  InvalidTemplateError,
  InvalidTemplateHeaderImageError,
  validateTemplateDefinition,
  withHeaderImageUrl,
} from './helpers/template-definition'

/**
 * A edição pedida fere uma regra da Meta que dá para saber antes de chamá-la:
 * estado que não permite editar, nome ou idioma trocados, categoria trocada em
 * template aprovado.
 */
export class TemplateNotEditableError extends InvalidTemplateError {
  constructor(message: string) {
    super(message)
    this.name = 'TemplateNotEditableError'
  }
}

/**
 * Estados que a Meta deixa editar. `PAUSED` não chega pela Omni hoje (a listagem só
 * traz `PENDING`/`APPROVED`/`REJECTED`), mas é editável na Meta e fica aqui para
 * quando chegar.
 */
const EDITABLE_STATUSES: readonly string[] = ['APPROVED', 'REJECTED', 'PAUSED']

export type UpdateConnectorTemplateInput = ResolveTemplateContextInput & {
  /** `id` remoto do template, como vem na listagem. */
  templateId: string
  name: string
  category: TemplateCategory
  language: string
  /**
   * Cabeçalho de imagem sem `example` e sem arquivo = manter a imagem: a amostra
   * enviada é a imagem padrão do envio do template.
   */
  components: TemplateComponent[]
  headerImageFile?: { data: Buffer }
}

/** Edita um template de um conector oficial (reenvia à aprovação da Meta). */
export class UpdateConnectorTemplateUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly templateProviderResolver: TemplateProviderResolver,
    private readonly sampleImageFetcher: TemplateSampleImageFetcher,
    private readonly imageStorage: TemplateImageStorage | null,
    private readonly templateDefaults: TemplateDefaultsRepository,
  ) {}

  async execute(input: UpdateConnectorTemplateInput): Promise<void> {
    const { wabaId, provider } = await resolveTemplateContext(
      input,
      {
        getAplicationContext: this.getAplicationContext,
        templateProviderResolver: this.templateProviderResolver,
      },
      { requireEnabled: true },
    )

    const current = (await provider.listTemplates(wabaId)).find(
      t => t.id === input.templateId,
    )
    if (!current) throw new TemplateNotFoundError(input.templateId)
    assertEditable(current, input)

    const scope: TemplateDefaultsScope = {
      domainId: input.domainId,
      subscriptionItemId: input.subscriptionItemId,
    }

    /**
     * Imagem mantida: o link que a Meta devolve é do CDN dela e não vale como
     * amostra (`2388215`), então a amostra é a imagem padrão do envio.
     */
    const keepsImage = keepsHeaderImage(input)
    let components = input.components
    if (keepsImage) {
      const defaults = await this.templateDefaults.find(scope, {
        name: current.name,
        language: current.language,
      })
      if (!defaults) {
        throw new InvalidTemplateHeaderImageError(
          'Este template ainda não tem imagem padrão do envio: envie uma imagem para usar como exemplo',
        )
      }
      components = withHeaderImageUrl(components, defaults.headerImageUrl)
    }

    validateTemplateDefinition({ ...input, components })
    const headerSampleImage = input.headerImageFile
      ? imageFromFile(input.headerImageFile.data)
      : undefined
    // A imagem padrão já passou pelas travas quando foi definida.
    if (!headerSampleImage && !keepsImage) {
      await assertSampleImage(this.sampleImageFetcher, components)
    }

    if (headerSampleImage && this.imageStorage) {
      const { url } = await this.imageStorage.store({
        data: headerSampleImage.data,
        contentType: headerSampleImage.contentType,
        scope: { domainId: input.domainId },
        retention: 'permanent',
      })
      components = withHeaderImageUrl(components, url)
      await provider.updateTemplate({
        wabaId,
        templateId: input.templateId,
        name: input.name,
        category: input.category,
        language: input.language,
        components,
      })
    } else {
      await provider.updateTemplate({
        wabaId,
        templateId: input.templateId,
        name: input.name,
        category: input.category,
        language: input.language,
        components,
        ...(headerSampleImage ? { headerSampleImage } : {}),
      })
    }

    // Imagem trocada na edição vira a nova imagem padrão do envio.
    if (!keepsImage) await this.saveDefaultImage(scope, input, components)
  }

  private async saveDefaultImage(
    scope: TemplateDefaultsScope,
    input: UpdateConnectorTemplateInput,
    components: TemplateComponent[],
  ): Promise<void> {
    const headerImageUrl = headerImageExampleOf(components)
    if (!headerImageUrl) return

    try {
      await this.templateDefaults.upsert(scope, {
        name: input.name,
        language: input.language,
        headerImageUrl,
      })
    } catch (error) {
      apiLogger.warn(
        {
          app: 'thinkzap',
          ...scope,
          template: input.name,
          err: error,
        },
        'Template editado, mas a imagem padrão do envio não foi gravada',
      )
    }
  }
}

function assertEditable(
  current: Template,
  input: UpdateConnectorTemplateInput,
): void {
  if (!EDITABLE_STATUSES.includes(current.status)) {
    throw new TemplateNotEditableError(
      'Template em análise não pode ser editado: aguarde a resposta da Meta',
    )
  }
  if (input.name !== current.name) {
    throw new TemplateNotEditableError(
      'O nome do template não pode ser alterado',
    )
  }
  if (input.language !== current.language) {
    throw new TemplateNotEditableError(
      'O idioma do template não pode ser alterado',
    )
  }
  if (current.status === 'APPROVED' && input.category !== current.category) {
    throw new TemplateNotEditableError(
      'A categoria de um template aprovado não pode ser alterada',
    )
  }
}

/** Cabeçalho de imagem sem exemplo e sem arquivo: o operador não trocou a imagem. */
function keepsHeaderImage(input: UpdateConnectorTemplateInput): boolean {
  return (
    !input.headerImageFile &&
    templateHeaderOf(input.components) === 'IMAGE' &&
    !headerImageExampleOf(input.components)
  )
}
