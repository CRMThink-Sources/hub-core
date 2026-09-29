import type { Tutorial, TutorialStep, RobosScreen } from '../../types'

/** Passos iguais nas duas variantes: abrir as regras e o "+" da etapa. */
const ROBOS_OPEN: TutorialStep<RobosScreen>[] = [
  {
    screen: 'kanban',
    title: 'Abra as regras de automação',
    description:
      'No CRM do Bitrix24, em Negócios, clique em Regras de automação. Os robôs do ThinkZap já vêm instalados com o app.',
    action: 'Regras de automação',
  },
  {
    screen: 'stages',
    title: 'Escolha a etapa',
    description:
      'O robô roda quando o negócio entra na etapa. Clique no + da etapa "Proposta enviada".',
    action: 'Adicionar robô em Proposta enviada',
  },
]

const ROBOS_MOVE: TutorialStep<RobosScreen> = {
  screen: 'move-deal',
  title: 'Mova um negócio',
  description:
    'Arraste um negócio para "Proposta enviada", como sua equipe faz no dia a dia.',
  action: 'Mover para Proposta enviada',
}

const tutorial: Tutorial<RobosScreen> = {
  slug: 'robos',
  label: 'Robôs de automação',
  variants: [
    {
      key: 'mensagem',
      label: 'Enviar mensagem',
      summary:
        'Mensagem de WhatsApp disparada sozinha quando o negócio muda de etapa.',
      steps: [
        ...ROBOS_OPEN,
        {
          screen: 'catalog',
          title: 'Escolha o robô do ThinkZap',
          description:
            'Na janela Adicionar, busque por "thinkzap" e clique em Adicionar em [ThinkZap] Enviar mensagem. Funciona com linhas WhatsApp Web e oficial.',
          action: '[ThinkZap] Enviar mensagem',
        },
        {
          screen: 'robot-form',
          title: 'Configure a mensagem',
          description:
            'Escolha a linha, o telefone de destino (um campo do CRM) e o texto — que pode usar campos do negócio e do contato.',
          action: 'Salvar',
        },
        ROBOS_MOVE,
        {
          screen: 'result',
          title: 'A mensagem sai sozinha',
          description:
            'O cliente recebe no WhatsApp e o envio fica registrado na timeline do negócio. Se não for entregue, a timeline avisa.',
          action: 'Abrir conversa',
        },
      ],
      done: {
        title: 'Automação no ar',
        description:
          'Lembretes, confirmações e follow-ups sem ninguém digitar. Quer automatizar o seu funil?',
      },
    },
    {
      key: 'template',
      label: 'Enviar template (API oficial)',
      summary:
        'Template aprovado pela Meta disparado sozinho quando o negócio muda de etapa.',
      steps: [
        ...ROBOS_OPEN,
        {
          screen: 'catalog-template',
          title: 'Escolha o robô de template',
          description:
            'Na janela Adicionar, busque por "thinkzap" e clique em Adicionar em [ThinkZap] Enviar Template. Ele envia pela linha do WhatsApp Oficial.',
          action: '[ThinkZap] Enviar Template',
        },
        {
          screen: 'template-form',
          title: 'Escolha linha e template',
          description:
            'Escolha a linha oficial e um template aprovado. Cada variável recebe um campo do CRM, e a prévia mostra como a mensagem chega.',
          action: 'Salvar',
        },
        ROBOS_MOVE,
        {
          screen: 'result-template',
          title: 'O template sai sozinho',
          description:
            'Por ser um template aprovado, a mensagem chega mesmo fora da janela de 24h. O envio fica na timeline do negócio — e cada template é cobrado pela Meta.',
          action: 'Abrir conversa',
        },
      ],
      done: {
        title: 'Template automático no ar',
        description:
          'Confirmações e lembretes pela API oficial, sem ninguém digitar. Quer automatizar o seu funil?',
      },
    },
  ],
}

/**
 * Textos das telas simuladas de `tutorials/robos.tsx`. O tipo sai daqui: a
 * versão em inglês precisa ter exatamente as mesmas chaves.
 */
const screens = {
  // Nome como o Bitrix24 lista: o nome do app entre colchetes antes do robô.
  robots: {
    message: '[ThinkZap] Enviar mensagem',
    template: '[ThinkZap] Enviar Template',
  },
  board: {
    extensions: 'Extensões',
    rules: 'Regras de automação',
    otherDeals: [
      {
        title: 'Reforma escritório',
        contact: 'Rafael Souza',
        value: 'R$ 8.900,00',
      },
      { title: 'Plano anual', contact: 'Ana Prado', value: 'R$ 12.000,00' },
    ],
  },
  stages: {
    title: 'Regras de automação · Negócios',
    hint: 'Os robôs rodam quando o negócio entra na etapa.',
  },
  catalog: {
    title: 'Adicionar',
    toStage: 'à etapa',
    search: 'thinkzap',
    group: 'Grupo',
    newRules: 'Novas regras de automação e gatilhos',
    recent: 'Itens recentes',
    // Grupos da janela "Adicionar", na ordem do Bitrix24.
    groups: {
      products: 'Produtos',
      tasks: 'Gerenciamento de tarefas',
      data: 'Armazenamento e modificação de dados',
      workflow: 'Automação do fluxo de trabalho',
      other: 'Outros',
    },
    market: 'Market',
    rules: 'Regras de automação e gatilhos',
    help: 'Ajuda',
    templateDescription:
      'Envia um template aprovado do WhatsApp Oficial pela linha escolhida',
    add: 'Adicionar',
  },
  // Rótulos do formulário padrão do Bitrix24, em inglês como no portal.
  robotForm: {
    connector: 'Connector',
    connectorValue: 'Linha 1 (WhatsApp Web)',
    destination: 'Destination',
    destinationValue: '{{Contato: Telefone}}',
    sendToAll: 'Send to all related contacts',
    sendToAllValue: 'Não',
    message: 'Message',
    messageValue:
      'Olá, {{Contato: Nome}}! Enviamos sua proposta por e-mail. Qualquer dúvida, é só responder aqui.',
    runWhen: (stage: string) =>
      `Executar: quando o negócio entrar na etapa "${stage}"`,
    cancel: 'Cancelar',
  },
  templateForm: {
    line: 'Linha do WhatsApp Oficial',
    lineValue: 'Linha 2',
    template: 'Template',
    templateValue: 'proposta_enviada (pt_BR)',
    sendToAll: 'Enviar para todos os contatos relacionados',
    sendToAllWarning:
      'Cada destinatário encontrado recebe um template — e cada template é cobrado pela Meta.',
    destination: 'Destino',
    destinationField: 'Contato: Telefone',
    variable: 'Variável {{1}}',
    variableField: 'Contato: Nome',
    preview: 'Prévia da mensagem',
    previewText:
      'Olá {Contato: Nome}! Enviamos sua proposta por e-mail. Qualquer dúvida, responda esta mensagem.',
    change: 'Trocar',
    cancel: 'Cancelar',
  },
  result: {
    dealStage: (id: number, stage: string) => `Negócio #${id} · etapa ${stage}`,
    history: 'Histórico',
    sentTitle: 'ThinkZap · mensagem enviada para o WhatsApp',
    robotLine: (robot: string) => `Robô "${robot}" · agora`,
    openChat: 'Abrir conversa',
    stageChanged: (from: string, to: string) =>
      `Etapa alterada: ${from} → ${to}`,
    store: 'Loja Acme',
    sent: {
      message:
        'Olá, Maria! Enviamos sua proposta por e-mail. Qualquer dúvida, é só responder aqui.',
      template:
        'Olá Maria! Enviamos sua proposta por e-mail. Qualquer dúvida, responda esta mensagem.',
    },
  },
}

export type RobosCopy = {
  tutorial: Tutorial<RobosScreen>
  screens: typeof screens
}

export const ROBOS_PT: RobosCopy = { tutorial, screens }
