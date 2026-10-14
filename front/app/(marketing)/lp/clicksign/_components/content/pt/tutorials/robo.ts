import type { Tutorial, RoboScreen } from '../../types'

const tutorial: Tutorial<RoboScreen> = {
  slug: 'robo',
  label: 'Robô de envio',
  summary:
    'O documento só é enviado pelo robô Enviar documento, numa etapa do funil de Negócios.',
  steps: [
    {
      screen: 'kanban',
      title: 'Abra as regras de automação',
      description:
        'No CRM do Bitrix24, em Negócios, clique em Regras de automação. O robô da Clicksign já vem instalado com o app e funciona só em Negócios.',
      action: 'Regras de automação',
    },
    {
      screen: 'stages',
      title: 'Escolha a etapa',
      description:
        'O documento sai quando o negócio entra na etapa. Clique no + da etapa "Contrato".',
      action: 'Adicionar robô em Contrato',
    },
    {
      screen: 'catalog',
      title: 'Escolha o robô da Clicksign',
      description:
        'Na janela Adicionar, busque por "clicksign" e clique em Adicionar em [Clicksign] Enviar documento.',
      action: '[Clicksign] Enviar documento',
    },
    {
      screen: 'robot-token',
      title: 'Escolha como chega o código',
      description:
        'Em Envio do token, escolha por onde quem assina recebe o código de confirmação: Email, SMS ou Whatsapp.',
      action: 'Envio do token',
    },
    {
      screen: 'robot-group',
      title: 'Escolha o grupo',
      description:
        'Em Grupo de assinatura, escolha o grupo criado no app. Ele não aparece? Salve os grupos no app e abra o robô de novo.',
      action: 'Grupo de assinatura',
    },
    {
      screen: 'robot-sequence',
      title: 'Defina a ordem e a recusa',
      description:
        'Em Ativar sequencia, Sim faz um assinar de cada vez — primeiro os participantes, depois os contatos — e os números de Grupo são ignorados. Não segue os números de Grupo. Em Recusar documento?, diga se quem assina pode recusar.',
      action: 'Ativar sequencia',
    },
    {
      screen: 'robot-save',
      title: 'Escolha a empresa e salve',
      description:
        'Em Empresa, escolha a conta da Clicksign que envia o documento e clique em Salvar.',
      action: 'Salvar',
    },
    {
      screen: 'move-deal',
      title: 'Mova um negócio',
      description:
        'Quando um negócio entra em "Contrato", o arquivo do campo Arquivo para Assinatura vai para a Clicksign e quem assina recebe o convite.',
      action: 'Mover para Contrato',
    },
  ],
  done: {
    title: 'Envio automático no ar',
    description:
      'Cada negócio que chega na etapa envia o próprio documento. A seguir, veja como acompanhar as assinaturas.',
  },
}

// O tipo sai daqui: os outros idiomas precisam ter as mesmas chaves.
const screens = {
  // Nome como o Bitrix24 lista: o nome do app entre colchetes antes do robô.
  robot: '[Clicksign] Enviar documento',
  board: {
    extensions: 'Extensões',
    rules: 'Regras de automação',
    otherDeals: [
      {
        title: 'Reforma escritório',
        contact: 'Rafael Souza',
        value: 'R$ 8.900,00',
      },
      { title: 'Consultoria', contact: 'Ana Prado', value: 'R$ 4.500,00' },
    ],
  },
  stages: {
    title: 'Regras de automação · Negócios',
    hint: 'Os robôs rodam quando o negócio entra na etapa.',
  },
  catalog: {
    title: 'Adicionar',
    toStage: 'à etapa',
    search: 'clicksign',
    rules: 'Regras de automação e gatilhos',
    description: 'Enviar documento para assinatura',
    add: 'Adicionar',
  },
  robotForm: {
    token: 'Envio do token',
    tokenValue: 'Email',
    group: 'Grupo de assinatura',
    sequence: 'Ativar sequencia',
    sequenceValue: 'Não',
    refusable: 'Recusar documento?',
    refusableValue: 'Não',
    company: 'Empresa',
    runWhen: (stage: string) =>
      `Executar: quando o negócio entrar na etapa "${stage}"`,
    save: 'Salvar',
    cancel: 'Cancelar',
  },
}

export type RoboCopy = {
  tutorial: Tutorial<RoboScreen>
  screens: typeof screens
}

export const ROBO_PT: RoboCopy = { tutorial, screens }
