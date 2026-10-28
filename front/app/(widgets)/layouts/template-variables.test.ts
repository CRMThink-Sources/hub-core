import { describe, expect, it } from 'vitest'
import {
  dynamicButtons,
  extractTemplateVariables,
  hasAllButtonValues,
  canSendWidgetTemplate,
  defaultHeaderImageOf,
  hasRequiredHeaderImage,
  needsHeaderImage,
  templateButtonParameters,
  widgetHeaderImageFileError,
  hasAllTemplateVariables,
  orderedTemplateParameters,
  resolveTemplatePreview,
} from './template-variables'

describe('extractTemplateVariables', () => {
  it('extrai posicionais na ordem de aparição', () => {
    expect(extractTemplateVariables('Olá {{1}}, pedido {{2}}.')).toEqual([
      '1',
      '2',
    ])
  })

  it('extrai nomeadas', () => {
    expect(
      extractTemplateVariables('Olá {{nome}}, código {{codigo}}.'),
    ).toEqual(['nome', 'codigo'])
  })

  it('nome repetido vira um único campo', () => {
    expect(
      extractTemplateVariables('Olá {{nome}}, tudo bem {{nome}}? Ped. {{2}}.'),
    ).toEqual(['nome', '2'])
  })

  it('ordem é a de aparição, não a numérica', () => {
    expect(extractTemplateVariables('{{2}} antes de {{1}}')).toEqual(['2', '1'])
  })

  it('tolera espaços dentro do placeholder', () => {
    expect(extractTemplateVariables('Olá {{ nome }}!')).toEqual(['nome'])
  })

  it('corpo sem placeholder não gera campo', () => {
    expect(extractTemplateVariables('Bom dia!')).toEqual([])
  })
})

describe('resolveTemplatePreview', () => {
  it('substitui os valores preenchidos', () => {
    expect(
      resolveTemplatePreview('Olá {{1}}, pedido {{2}}.', {
        '1': 'Maria',
        '2': '99',
      }),
    ).toBe('Olá Maria, pedido 99.')
  })

  it('mantém o placeholder do que ainda não foi preenchido', () => {
    expect(
      resolveTemplatePreview('Olá {{1}}, pedido {{2}}.', { '1': 'Maria' }),
    ).toBe('Olá Maria, pedido {{2}}.')
  })

  it('valor vazio conta como não preenchido', () => {
    expect(resolveTemplatePreview('Olá {{1}}!', { '1': '' })).toBe('Olá {{1}}!')
  })

  it('nome repetido recebe o mesmo valor', () => {
    expect(
      resolveTemplatePreview('{{nome}} e {{nome}}', { nome: 'Maria' }),
    ).toBe('Maria e Maria')
  })

  it('corpo sem placeholder sai intacto', () => {
    expect(resolveTemplatePreview('Bom dia!', {})).toBe('Bom dia!')
  })
})

describe('orderedTemplateParameters', () => {
  it('devolve os valores na ordem de aparição', () => {
    expect(
      orderedTemplateParameters('{{2}} antes de {{1}}', {
        '1': 'um',
        '2': 'dois',
      }),
    ).toEqual(['dois', 'um'])
  })

  it('variável sem valor vira string vazia', () => {
    expect(orderedTemplateParameters('{{1}} {{2}}', { '1': 'um' })).toEqual([
      'um',
      '',
    ])
  })

  it('template sem variável não manda parâmetro', () => {
    expect(orderedTemplateParameters('Bom dia!', {})).toEqual([])
  })
})

describe('hasAllTemplateVariables', () => {
  it('true quando todas estão preenchidas', () => {
    expect(hasAllTemplateVariables('{{1}} {{2}}', { '1': 'a', '2': 'b' })).toBe(
      true,
    )
  })

  it('false quando falta alguma', () => {
    expect(hasAllTemplateVariables('{{1}} {{2}}', { '1': 'a' })).toBe(false)
  })

  it('só espaço não conta como preenchido', () => {
    expect(hasAllTemplateVariables('{{1}}', { '1': '   ' })).toBe(false)
  })

  it('true para template sem variável', () => {
    expect(hasAllTemplateVariables('Bom dia!', {})).toBe(true)
  })
})

describe('botões dinâmicos', () => {
  const buttons = [
    {
      index: 0,
      type: 'QUICK_REPLY' as const,
      text: 'Obrigado',
      dynamic: false,
    },
    { index: 1, type: 'URL' as const, text: 'Rastrear', dynamic: true },
    { index: 2, type: 'COPY_CODE' as const, text: '', dynamic: true },
  ]

  it('separa os botões que pedem valor', () => {
    expect(dynamicButtons(buttons).map(b => b.index)).toEqual([1, 2])
    expect(dynamicButtons(undefined)).toEqual([])
  })

  it('exige valor em todo botão dinâmico', () => {
    expect(hasAllButtonValues(buttons, { 1: 'PED-1' })).toBe(false)
    expect(hasAllButtonValues(buttons, { 1: 'PED-1', 2: '  ' })).toBe(false)
    expect(hasAllButtonValues(buttons, { 1: 'PED-1', 2: 'BLACK10' })).toBe(true)
  })

  it('template só com botões estáticos não pede nada', () => {
    expect(hasAllButtonValues([buttons[0]], {})).toBe(true)
    expect(templateButtonParameters([buttons[0]], {})).toEqual([])
  })

  it('monta os parâmetros com index e subtipo', () => {
    expect(
      templateButtonParameters(buttons, { 1: ' PED-1 ', 2: 'BLACK10' }),
    ).toEqual([
      { index: 1, subType: 'URL', value: 'PED-1' },
      { index: 2, subType: 'COPY_CODE', value: 'BLACK10' },
    ])
  })
})

describe('imagem do cabeçalho', () => {
  const image = { header: { type: 'IMAGE' as const } }
  const none = { header: { type: 'NONE' as const } }

  it('só template com cabeçalho de imagem pede a URL', () => {
    expect(needsHeaderImage(image)).toBe(true)
    expect(needsHeaderImage(none)).toBe(false)
    expect(needsHeaderImage({})).toBe(false)
  })

  it('bloqueia o envio com URL vazia ou sem https', () => {
    expect(hasRequiredHeaderImage(image, '')).toBe(false)
    expect(hasRequiredHeaderImage(image, 'http://loja.com/a.png')).toBe(false)
    expect(hasRequiredHeaderImage(image, 'loja.com/a.png')).toBe(false)
    expect(hasRequiredHeaderImage(image, 'https://loja.com/promo.jpg')).toBe(
      true,
    )
  })

  it('template sem imagem não exige nada', () => {
    expect(hasRequiredHeaderImage(none, '')).toBe(true)
    expect(hasRequiredHeaderImage(undefined, '')).toBe(true)
  })
})

describe('imagem padrão do envio', () => {
  const withDefault = {
    body: 'Oferta',
    buttons: [],
    header: { type: 'IMAGE' as const, defaultImageUrl: 'https://cdn/a.png' },
  }
  const withoutDefault = {
    body: 'Oferta',
    buttons: [],
    header: { type: 'IMAGE' as const },
  }
  const send = (
    template: typeof withDefault | typeof withoutDefault,
    headerImageUrl: string,
  ) =>
    canSendWidgetTemplate({
      template,
      values: {},
      buttonValues: {},
      headerImageUrl,
      headerImageUploading: false,
    })

  it('só template de imagem com padrão definida tem imagem padrão', () => {
    expect(defaultHeaderImageOf(withDefault)).toBe('https://cdn/a.png')
    expect(defaultHeaderImageOf(withoutDefault)).toBeUndefined()
    expect(
      defaultHeaderImageOf({
        header: { type: 'NONE', defaultImageUrl: 'https://cdn/a.png' },
      }),
    ).toBeUndefined()
  })

  it('com a imagem padrão preenchida, o envio fica liberado', () => {
    expect(send(withDefault, 'https://cdn/a.png')).toBe(true)
  })

  it('sem imagem padrão e sem imagem informada, o envio fica bloqueado', () => {
    expect(send(withoutDefault, '')).toBe(false)
  })

  it('imagem trocada no envio também libera', () => {
    expect(send(withoutDefault, 'https://loja.com/b.png')).toBe(true)
  })
})

describe('upload da imagem do cabeçalho', () => {
  it('recusa PDF e arquivo de 7 MB antes de subir', () => {
    expect(
      widgetHeaderImageFileError({ type: 'application/pdf', size: 10 }),
    ).toBe('A imagem precisa ser JPEG ou PNG.')
    expect(
      widgetHeaderImageFileError({ type: 'image/png', size: 7 * 1024 * 1024 }),
    ).toBe('A imagem passa de 5 MB.')
    expect(
      widgetHeaderImageFileError({ type: 'image/jpeg', size: 1024 }),
    ).toBeNull()
  })

  const template = {
    body: 'Oferta {{1}}',
    buttons: [],
    header: { type: 'IMAGE' as const },
  }
  const ready = {
    template,
    values: { 1: 'Ana' },
    buttonValues: {},
    headerImageUrl: 'https://imagens.loja.com/x.png',
    headerImageUploading: false,
  }

  it('pode enviar com a URL do upload pronta', () => {
    expect(canSendWidgetTemplate(ready)).toBe(true)
  })

  it('bloqueia com upload em andamento', () => {
    expect(
      canSendWidgetTemplate({ ...ready, headerImageUploading: true }),
    ).toBe(false)
  })

  it('bloqueia sem URL (upload falhou ou não feito)', () => {
    expect(canSendWidgetTemplate({ ...ready, headerImageUrl: '' })).toBe(false)
  })

  it('bloqueia com variável vazia', () => {
    expect(canSendWidgetTemplate({ ...ready, values: { 1: ' ' } })).toBe(false)
  })
})
