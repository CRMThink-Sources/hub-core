import type { Tutorial, ErrosScreen } from '../../types'

const tutorial: Tutorial<ErrosScreen> = {
  slug: 'erros',
  label: 'Erros e reprocessamento',
  summary:
    'Veja as linhas rejeitadas, reprocesse depois de corrigir e escolha quem recebe o aviso.',
  steps: [
    {
      screen: 'list',
      title: 'Abra os erros da importação',
      description:
        'Quando uma rodada é concluída com erros, a importação ganha a bolinha amarela e o botão Ver erros.',
      action: 'Ver erros',
    },
    {
      screen: 'errors',
      title: 'Corrija e reprocesse',
      description:
        'Cada linha rejeitada aparece com o motivo (até 50 por rodada). Corrija a planilha ou o Bitrix24 e clique em Reprocessar — ou em Reprocessar todas.',
      action: 'Reprocessar',
    },
    {
      screen: 'notify',
      title: 'Escolha quem é avisado',
      description:
        'Em Configurações, no card Notificações de erro, marque os usuários do Bitrix24 que devem ser avisados quando uma importação tiver erros.',
      action: 'Selecionar Ana Souza',
    },
    {
      screen: 'save',
      title: 'Salve os destinatários',
      description: 'Os escolhidos aparecem em Destinatários. Clique em Salvar.',
      action: 'Salvar',
    },
  ],
  done: {
    title: 'Avisos configurados',
    description:
      'Os destinatários recebem uma notificação no Bitrix24 quando uma importação tiver erros — no máximo uma a cada 6 horas por importação.',
  },
}

const screens = {
  modal: {
    title: 'Importação concluída com erros',
    description:
      'As linhas abaixo foram rejeitadas. Corrija a planilha e reprocesse.',
    row: (row: number) => `Linha ${row}`,
    reprocess: 'Reprocessar',
    reprocessAll: 'Reprocessar todas',
    close: 'Fechar',
  },
  errorRows: [
    {
      row: 14,
      message: 'Match ambíguo: identificador casou com mais de um registro',
    },
    { row: 27, message: 'Campo obrigatório não preenchido: Nome' },
  ],
  users: ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Rocha'],
}

export type ErrosCopy = {
  tutorial: Tutorial<ErrosScreen>
  screens: typeof screens
}

export const ERROS_PT: ErrosCopy = { tutorial, screens }
