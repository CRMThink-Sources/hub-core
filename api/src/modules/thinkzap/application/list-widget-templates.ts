import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import {
  Template,
  TemplateComponent,
} from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import {
  TemplateButtonSummary,
  templateButtonsOf,
} from '@/modules/thinkzap/domain/template-buttons'
import {
  TemplateHeaderType,
  templateHeaderOf,
} from '@/modules/thinkzap/domain/template-header'
import type { TemplateDefaultsRepository } from '@/modules/thinkzap/domain/ports/template-defaults-repository.port'
import {
  resolveTemplateContext,
  type ResolveTemplateContextInput,
} from './helpers/resolve-template-context'
import { loadDefaultImages } from './helpers/template-default-images'

/**
 * O mínimo que o widget precisa para compor um template.
 *
 * Shape próprio e não `Template`: a rota é aberta a qualquer usuário Bitrix com
 * JWT (bloco do widget), e `Template` carrega `id` remoto, `category`, `status` e
 * os `components` crus, que o widget não usa. Mesma defesa que
 * `WidgetLineStatus` faz para o status da linha.
 */
export type WidgetTemplate = {
  /** Nome do template aprovado — é ele que o envio manda ao provider. */
  name: string
  language: string
  /** Texto do `BODY`, com os placeholders intactos: o widget deriva os campos dele. */
  body: string
  /**
   * Botões na ordem do template. Sem `url` nem exemplo: o widget só precisa do
   * rótulo para o preview e de `dynamic`/`index` para pedir e enviar o valor.
   */
  buttons: TemplateButtonSummary[]
  /**
   * Tipo do cabeçalho. `IMAGE` leva a imagem padrão do envio, quando definida; sem
   * ela, o envio pede a imagem.
   */
  header: { type: WidgetTemplateHeaderType; defaultImageUrl?: string }
}

/** `UNSUPPORTED` nunca chega aqui: esses templates saem do catálogo. */
export type WidgetTemplateHeaderType = Exclude<
  TemplateHeaderType,
  'UNSUPPORTED'
>

/**
 * Templates de uma linha oficial, para o widget.
 *
 * Duas diferenças de `ListConnectorTemplatesUseCase`, e são as duas razões desta
 * casca existir:
 *
 * 1. **Só `APPROVED`.** Template pendente ou reprovado não pode ser enviado, e
 *    ofertá-lo no select transformaria a recusa da Meta em erro na cara do
 *    operador, depois de ele já ter preenchido as variáveis.
 * 2. **Payload mínimo.** Ver `WidgetTemplate`.
 *
 * Também saem os templates com cabeçalho que o ThinkZap não sabe preencher (vídeo,
 * documento, localização, texto com variável): o envio falharia na Meta.
 *
 * `requireEnabled` fica em `false`: listar é leitura, e é o mesmo critério da tela
 * de conexões. Quem recusa linha bloqueada é o envio.
 */
export class ListWidgetTemplatesUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly templateProviderResolver: TemplateProviderResolver,
    /** Imagem padrão do envio. `null` = catálogo sem ela (o envio pede a imagem). */
    private readonly templateDefaults: TemplateDefaultsRepository | null = null,
  ) {}

  async execute(input: ResolveTemplateContextInput): Promise<WidgetTemplate[]> {
    const { wabaId, provider } = await resolveTemplateContext(input, {
      getAplicationContext: this.getAplicationContext,
      templateProviderResolver: this.templateProviderResolver,
    })

    const approved = (await provider.listTemplates(wabaId)).filter(
      template => template.status === 'APPROVED',
    )
    // Só consulta o banco quando há template com imagem.
    const defaultImageOf = approved.some(
      t => templateHeaderOf(t.components) === 'IMAGE',
    )
      ? await loadDefaultImages(this.templateDefaults, input)
      : () => undefined

    return approved.flatMap(template => {
      const header = templateHeaderOf(template.components)
      if (header === 'UNSUPPORTED') return []
      const defaultImageUrl =
        header === 'IMAGE' ? defaultImageOf(template) : undefined
      return [toWidgetTemplate(template, header, defaultImageUrl)]
    })
  }
}

function toWidgetTemplate(
  template: Template,
  header: WidgetTemplateHeaderType,
  defaultImageUrl: string | undefined,
): WidgetTemplate {
  return {
    name: template.name,
    language: template.language,
    body: bodyText(template.components),
    buttons: templateButtonsOf(template.components),
    header: defaultImageUrl
      ? { type: header, defaultImageUrl }
      : { type: header },
  }
}

/**
 * Texto do `BODY`. Template sem `BODY` legível cai em string vazia em vez de sair
 * da lista: ele **é** enviável (o corpo pode ser só mídia de cabeçalho), e sumir
 * da lista sem explicação seria pior que aparecer sem preview.
 */
function bodyText(components: TemplateComponent[]): string {
  const body = components.find(component => component.type === 'BODY')
  return typeof body?.text === 'string' ? body.text : ''
}
