import type { Tutorial, AgendamentoScreen } from '../../types'

const tutorial: Tutorial<AgendamentoScreen> = {
  slug: 'agendamento',
  label: 'Agendamento',
  summary:
    'Rode a importação sozinha, de tempos em tempos, ou só quando você mandar.',
  steps: [
    {
      screen: 'frequency',
      title: 'Escolha a frequência',
      description:
        'Na seção Agendamento, escolha Horas para rodar a cada X horas, ou Dias da semana para rodar nos dias marcados, sempre às 00:00 (horário de Brasília).',
      action: 'Horas',
    },
    {
      screen: 'hours',
      title: 'Defina o intervalo e salve',
      description:
        'Em "A cada (horas)", informe de 1 a 23. Prefere rodar só quando quiser? Ligue "Executar importação manualmente". Depois, Salvar.',
      action: 'Salvar',
    },
    {
      screen: 'scheduled',
      title: 'Pause quando precisar',
      description:
        'Na lista, a importação mostra a frequência e a chave do agendamento. Desligue para pausar e ligue de novo para ativar.',
      action: 'Pausar agendamento',
    },
    {
      screen: 'manual-run',
      title: 'Rode uma importação manual',
      description:
        'Importações em modo manual têm o botão Executar no lugar da chave. Clique para rodar agora.',
      action: 'Executar',
    },
    {
      screen: 'queued',
      title: 'Acompanhe a execução',
      description:
        'A importação entra na fila e a lista mostra Em execução. Cada rodada lê só as linhas novas, a partir de onde a anterior parou.',
      action: 'Em execução',
    },
  ],
  done: {
    title: 'Agendamento pronto',
    description:
      'Adicione linhas no fim da planilha e elas chegam ao Bitrix24 na próxima rodada, sem repetir as que já foram importadas.',
  },
}

const screens = {
  queuedToast: 'Importação enfileirada para execução.',
  everyHours: 6,
}

export type AgendamentoCopy = {
  tutorial: Tutorial<AgendamentoScreen>
  screens: typeof screens
}

export const AGENDAMENTO_PT: AgendamentoCopy = { tutorial, screens }
