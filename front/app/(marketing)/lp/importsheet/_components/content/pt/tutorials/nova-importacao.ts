import type { Tutorial, NovaImportacaoScreen } from '../../types'

const tutorial: Tutorial<NovaImportacaoScreen> = {
  slug: 'nova-importacao',
  label: 'Nova importação',
  summary: 'Escolha a planilha do Google e a aba que vai para o Bitrix24.',
  steps: [
    {
      screen: 'empty',
      title: 'Comece uma importação',
      description: 'Em Importações, clique em Nova importação.',
      action: 'Nova importação',
    },
    {
      screen: 'paste',
      title: 'Cole o link da planilha',
      description:
        'Cole o link inteiro da planilha ou só o ID — o trecho entre /d/ e /edit no endereço docs.google.com/spreadsheets/d/…. Depois clique em Validar.',
      action: 'Validar',
    },
    {
      screen: 'tabs',
      title: 'Selecione a aba',
      description:
        'Com a planilha validada, aparecem as abas com o total de linhas e colunas de cada uma. Escolha a que tem os dados.',
      action: 'Selecionar a aba',
    },
    {
      screen: 'selected',
      title: 'Continue para a configuração',
      description:
        'Aba escolhida, clique em Continuar para definir o destino no Bitrix24 e o mapeamento das colunas.',
      action: 'Continuar',
    },
  ],
  done: {
    title: 'Planilha validada',
    description:
      'Se a validação falhar, confira o link e se a planilha está compartilhada com o e-mail da conta Google conectada.',
  },
}

const screens = {
  modal: {
    title: 'Nova importação',
    description: 'Informe o ID (ou link) da planilha do Google',
    idLabel: 'ID da planilha',
    placeholder: 'ex.: 1AbC…XyZ ou a URL da planilha',
    validate: 'Validar',
    urlHint: 'O ID fica na URL:',
    selectTab: 'Selecione a aba',
    rowsCols: (rows: number, cols: number) =>
      `${rows} linhas · ${cols} colunas`,
    cancel: 'Cancelar',
    proceed: 'Continuar',
  },
  pastedUrl: 'https://docs.google.com/spreadsheets/d/1AbC9xZ…/edit',
  tabs: [
    { title: 'Pedidos', rows: 1250, cols: 6 },
    { title: 'Arquivo 2025', rows: 830, cols: 6 },
  ],
}

export type NovaImportacaoCopy = {
  tutorial: Tutorial<NovaImportacaoScreen>
  screens: typeof screens
}

export const NOVA_IMPORTACAO_PT: NovaImportacaoCopy = { tutorial, screens }
