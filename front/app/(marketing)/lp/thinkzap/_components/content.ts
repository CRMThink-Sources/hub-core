/**
 * Toda a copy da LP do ThinkZap num lugar só, para o comercial revisar sem
 * procurar texto no JSX. Os ícones ficam nos componentes; aqui só a chave.
 */

export const WHATSAPP_MESSAGE =
  'Olá! Vim pela página do ThinkZap e quero saber mais sobre o WhatsApp no Bitrix24.'

export const HERO = {
  eyebrow: 'WhatsApp dentro do Bitrix24',
  title: 'Atenda, venda e automatize pelo WhatsApp sem sair do seu CRM',
  subtitle:
    'O ThinkZap conecta o WhatsApp Web e a API oficial do WhatsApp ao Bitrix24. Conversas caem nas linhas abertas, ficam no histórico do cliente e entram nas suas automações.',
}

export type FeatureIcon =
  | 'channels'
  | 'lines'
  | 'buttons'
  | 'templates'
  | 'automation'
  | 'stats'
  | 'permissions'
  | 'media'

export const FEATURES: {
  icon: FeatureIcon
  title: string
  description: string
}[] = [
  {
    icon: 'channels',
    title: 'WhatsApp Web e API oficial',
    description:
      'Use o número que você já tem pelo WhatsApp Web ou conecte a API oficial do WhatsApp Business — os dois no mesmo painel.',
  },
  {
    icon: 'lines',
    title: 'Várias linhas',
    description:
      'Conecte quantos números precisar e ligue cada um a uma linha aberta do Bitrix24, por equipe ou operação.',
  },
  {
    icon: 'buttons',
    title: 'Botões interativos',
    description:
      'Envie mensagens com botões de resposta e registre o que o cliente escolheu direto na timeline.',
  },
  {
    icon: 'templates',
    title: 'Templates de mensagem',
    description:
      'Dispare templates aprovados da API oficial para reabrir conversas e fazer comunicações ativas.',
  },
  {
    icon: 'automation',
    title: 'Robôs de automação',
    description:
      'Envie mensagens a partir de regras e robôs do Bitrix24: novo negócio, mudança de etapa, lembrete de pagamento.',
  },
  {
    icon: 'stats',
    title: 'Painel de mensagens',
    description:
      'Acompanhe o volume de mensagens enviadas e recebidas por período e por conexão.',
  },
  {
    icon: 'permissions',
    title: 'Permissões por equipe',
    description:
      'Defina quem acessa as conexões e as configurações, por usuário ou departamento.',
  },
  {
    icon: 'media',
    title: 'Áudio, imagem e documentos',
    description:
      'Mídias, respostas e edições de mensagem sincronizadas entre o WhatsApp e o chat do Bitrix24.',
  },
]

/**
 * Tutoriais da seção "Tutoriais": cada um é uma simulação clicável que espelha o
 * fluxo e os textos reais do app e do Bitrix24. `screen` é o id da tela que
 * `tutorials/<slug>.tsx` desenha; `action` é o rótulo acessível do elemento
 * destacado que o visitante clica. Se o fluxo mudar no app, mude aqui e no
 * arquivo de telas do tutorial.
 */
export type TutorialStep<Screen extends string = string> = {
  screen: Screen
  title: string
  description: string
  action: string
}

/** Uma sequência de passos com a tela de conclusão. */
export type TutorialTrack<Screen extends string = string> = {
  /** Uma frase abaixo das abas, dizendo o que o tutorial cobre. */
  summary: string
  steps: TutorialStep<Screen>[]
  done: { title: string; description: string }
}

/** Variante de um tutorial, escolhida no submenu da aba. */
export type TutorialVariant<Screen extends string = string> =
  TutorialTrack<Screen> & {
    /** Sufixo da âncora: `#tutorial-<slug>-<key>`. */
    key: string
    /** Texto do submenu. */
    label: string
  }

/**
 * Tutorial de uma aba: uma trilha só ou, com `variants`, um submenu com uma
 * trilha por variante (a primeira abre por padrão).
 */
export type Tutorial<Screen extends string = string> = {
  slug: TutorialSlug
  /** Texto da aba. */
  label: string
} & (
  | (TutorialTrack<Screen> & { variants?: undefined })
  | { variants: TutorialVariant<Screen>[] }
)

/** Trilhas de um tutorial: as variantes ou a trilha única (sem `key`). */
export function tutorialTracks(tutorial: Tutorial): TutorialVariant[] {
  if (tutorial.variants) return tutorial.variants
  const { summary, steps, done, label } = tutorial
  return [{ key: '', label, summary, steps, done }]
}

export const TUTORIAL_SLUGS = [
  'instalacao',
  'ativacao',
  'thinkbot',
  'api-oficial',
  'robos',
  'grupos',
] as const
export type TutorialSlug = (typeof TUTORIAL_SLUGS)[number]

export type InstalacaoScreen = 'market' | 'install'

export const INSTALACAO: Tutorial<InstalacaoScreen> = {
  slug: 'instalacao',
  label: 'Instalação',
  summary: 'Do Bitrix24 Market ao app instalado no seu portal.',
  steps: [
    {
      screen: 'market',
      title: 'Encontre o ThinkZap no Market',
      description:
        'No seu Bitrix24, abra o Market, busque por ThinkZap e clique em Instalar.',
      action: 'Instalar',
    },
    {
      screen: 'install',
      title: 'Aceite os termos e conclua',
      description:
        'Na tela de instalação, aceite os termos do Bitrix24 Market. O e-mail é opcional.',
      action: 'Concluir instalação',
    },
  ],
  done: {
    title: 'ThinkZap instalado',
    description:
      'O app já está no menu do seu Bitrix24. Agora é ativar o teste e conectar o número.',
  },
}

export type AtivacaoScreen =
  | 'trial'
  | 'contact'
  | 'lines'
  | 'qrcode'
  | 'connected'
  | 'channel'
  | 'chat'

export const ATIVACAO: Tutorial<AtivacaoScreen> = {
  slug: 'ativacao',
  label: 'Ativação',
  summary:
    'Teste grátis, primeira linha, QR code e o vínculo com o canal aberto.',
  steps: [
    {
      screen: 'trial',
      title: 'Comece o teste grátis de 3 dias',
      description:
        'O ThinkZap abre em Conexões. Escolha o tipo de conector — aqui, WhatsApp Web, que conecta pelo QR code.',
      action: 'Começar teste',
    },
    {
      screen: 'contact',
      title: 'Confirme seus dados de contato',
      description:
        'Os dados já vêm do seu Bitrix24. Confira e ative o teste — sua primeira linha é criada na hora.',
      action: 'Ativar teste',
    },
    {
      screen: 'lines',
      title: 'Abra a linha criada',
      description:
        'A linha nova aparece na lista de conexões. Clique nela para abrir as configurações.',
      action: 'Abrir a linha',
    },
    {
      screen: 'qrcode',
      title: 'Leia o QR code no celular',
      description:
        'Na aba Conexão, abra o WhatsApp do número, vá em Aparelhos conectados → Conectar um aparelho e aponte para o código.',
      action: 'Simular leitura do QR code',
    },
    {
      screen: 'connected',
      title: 'Número conectado',
      description:
        'A linha passa para Conectada e mostra os dados do aparelho. Falta dizer para qual canal do Bitrix24 as conversas vão: abra a aba Ajustes.',
      action: 'Ajustes',
    },
    {
      screen: 'channel',
      title: 'Vincule a um canal aberto',
      description:
        'Escolha o canal aberto do Bitrix24 que recebe as conversas desta linha — é o vínculo que faz a mensagem chegar ao CRM.',
      action: 'Vincular',
    },
    {
      screen: 'chat',
      title: 'Atenda pelo Bitrix24',
      description:
        'As mensagens chegam no chat do canal aberto, vinculadas ao contato no CRM. Sua equipe responde sem sair do Bitrix24.',
      action: 'Enviar resposta',
    },
  ],
  done: {
    title: 'Pronto! Seu WhatsApp está no Bitrix24',
    description:
      'Foi isso: ativar, conectar e atender. Quer fazer no seu portal?',
  },
}

export type ThinkbotScreen =
  | 'empty'
  | 'new-flow'
  | 'editor'
  | 'kind-menu'
  | 'block-panel'
  | 'simulator-start'
  | 'simulator-chat'
  | 'publish'
  | 'bind'
  | 'bot-chat'

export const THINKBOT: Tutorial<ThinkbotScreen> = {
  slug: 'thinkbot',
  label: 'ThinkBot',
  summary:
    'Monte um chatbot que atende no canal aberto e passa para um atendente quando precisa.',
  steps: [
    {
      screen: 'empty',
      title: 'Abra o ThinkBot',
      description:
        'No menu do ThinkZap, clique em ThinkBot. Sem nenhum fluxo ainda, comece por Criar fluxo.',
      action: 'Criar fluxo',
    },
    {
      screen: 'new-flow',
      title: 'Dê um nome ao fluxo',
      description:
        'O nome é só para identificar o fluxo aqui dentro — o cliente não vê.',
      action: 'Criar',
    },
    {
      screen: 'editor',
      title: 'O fluxo começa com as boas-vindas',
      description:
        'Todo fluxo nasce com um bloco de boas-vindas. Clique no + da saída dele para dizer o que vem depois.',
      action: 'Adicionar próximo passo',
    },
    {
      screen: 'kind-menu',
      title: 'Escolha a interação',
      description:
        'Mensagem, pergunta com opções, captura de dados, condição, transferência ou encerramento — e blocos prontos que consultam o CRM. Aqui, uma Pergunta.',
      action: 'Pergunta',
    },
    {
      screen: 'block-panel',
      title: 'Escreva a pergunta e as opções',
      description:
        'Cada opção leva para um bloco. "Suporte" vai para um bloco Transferir, que passa a conversa para a fila do canal aberto. Depois, teste no simulador.',
      action: 'simulador',
    },
    {
      screen: 'simulator-start',
      title: 'Teste antes de publicar',
      description:
        'O simulador roda o fluxo como se você fosse o cliente no WhatsApp. Não envia nada para ninguém.',
      action: 'Iniciar conversa',
    },
    {
      screen: 'simulator-chat',
      title: 'Responda como cliente',
      description:
        'O bot mandou as boas-vindas e a pergunta. Responda "Suporte" para ver a transferência.',
      action: 'Enviar',
    },
    {
      screen: 'publish',
      title: 'Funcionou: publique',
      description:
        'A conversa foi passada para um atendente, como planejado. Publique o fluxo — com algum problema no fluxo, a publicação é recusada e o editor mostra onde.',
      action: 'Publicar',
    },
    {
      screen: 'bind',
      title: 'Escolha onde ele atende',
      description:
        'De volta à lista, escolha em "Atende em" o canal aberto do Bitrix24 e ative. Vale para qualquer canal aberto, de qualquer tipo de conexão.',
      action: 'ativar',
    },
    {
      screen: 'bot-chat',
      title: 'O bot atende no Bitrix24',
      description:
        'Cada mensagem nova no canal passa pelo fluxo. Quando o cliente pede suporte, a conversa vai para a fila e o atendente assume dali.',
      action: 'Enviar',
    },
  ],
  done: {
    title: 'Seu ThinkBot está atendendo',
    description:
      'O bot faz a triagem e sua equipe entra só quando precisa. Quer montar o seu?',
  },
}

export type ApiOficialScreen =
  | 'lines'
  | 'new-line'
  | 'pending-line'
  | 'connect'
  | 'connected'
  | 'templates'
  | 'template-form'
  | 'template-pending'
  | 'crm-send'

export const API_OFICIAL: Tutorial<ApiOficialScreen> = {
  slug: 'api-oficial',
  label: 'API oficial e templates',
  summary:
    'Linha na API oficial do WhatsApp, template aprovado pela Meta e envio pelo CRM.',
  steps: [
    {
      screen: 'lines',
      title: 'Crie uma linha nova',
      description: 'Em Conexões, clique em Nova linha.',
      action: 'Nova linha',
    },
    {
      screen: 'new-line',
      title: 'Escolha WhatsApp Oficial',
      description:
        'Selecione o conector WhatsApp Oficial — canal da Meta, com número verificado e templates — e o plano.',
      action: 'Criar linha',
    },
    {
      screen: 'pending-line',
      title: 'Abra a linha nova',
      description:
        'Ela aparece como Aguardando conexão. Clique para abrir as configurações.',
      action: 'Abrir a linha',
    },
    {
      screen: 'connect',
      title: 'Conecte o número na Meta',
      description:
        'Na aba Conexão, clique em Conectar número. A Meta abre a autenticação da sua conta do WhatsApp Business, e é lá que você escolhe o número.',
      action: 'Conectar número',
    },
    {
      screen: 'connected',
      title: 'Número conectado',
      description:
        'A linha fica ligada à sua conta do WhatsApp Business (WABA) e os templates passam a funcionar. Abra a aba Templates.',
      action: 'Templates',
    },
    {
      screen: 'templates',
      title: 'Crie um template',
      description:
        'Templates são mensagens aprovadas pela Meta para iniciar conversa fora da janela de 24h. Clique em Novo template.',
      action: 'Novo template',
    },
    {
      screen: 'template-form',
      title: 'Escreva e envie para aprovação',
      description:
        'Nome, categoria, idioma e corpo. {{1}} vira um dado do cliente na hora do envio, e a Meta pede um exemplo de cada variável.',
      action: 'Enviar para aprovação',
    },
    {
      screen: 'template-pending',
      title: 'Aguarde a aprovação',
      description:
        'O template fica Pendente até a Meta avaliar. Sincronizar busca o status atualizado.',
      action: 'Sincronizar',
    },
    {
      screen: 'crm-send',
      title: 'Envie pelo CRM',
      description:
        'No negócio, abra a aba ThinkZap, escolha a linha oficial, o número e o template. O mesmo template também pode sair por robô de automação ou por Campanha de SMS do Bitrix24.',
      action: 'Enviar',
    },
  ],
  done: {
    title: 'Template enviado pela API oficial',
    description:
      'Número verificado, template aprovado e envio sem sair do CRM. Vamos conectar o seu?',
  },
}

export type RobosScreen =
  | 'kanban'
  | 'stages'
  | 'catalog'
  | 'robot-form'
  | 'catalog-template'
  | 'template-form'
  | 'move-deal'
  | 'result'
  | 'result-template'

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

export const ROBOS: Tutorial<RobosScreen> = {
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

export type GruposScreen =
  | 'groups-tab'
  | 'groups-list'
  | 'group-form'
  | 'group-ready'
  | 'group-created'
  | 'group-chat'

export const GRUPOS: Tutorial<GruposScreen> = {
  slug: 'grupos',
  label: 'Grupos do WhatsApp',
  summary:
    'Crie grupos pelo Bitrix24 e atenda as conversas do grupo no canal aberto.',
  steps: [
    {
      screen: 'groups-tab',
      title: 'Abra a aba Grupos',
      description:
        'Nas configurações de uma linha WhatsApp Web conectada, abra Grupos. Grupos existem só em linhas WhatsApp Web.',
      action: 'Grupos',
    },
    {
      screen: 'groups-list',
      title: 'Crie um grupo',
      description: 'A lista mostra os grupos do número. Clique em Novo grupo.',
      action: 'Novo grupo',
    },
    {
      screen: 'group-form',
      title: 'Nome e participantes',
      description:
        'Busque os contatos no Bitrix24 e marque os telefones — ou digite um número à mão.',
      action: 'Adicionar selecionados',
    },
    {
      screen: 'group-ready',
      title: 'Crie o grupo',
      description:
        'Quem não puder ser adicionado direto pode receber um convite privado.',
      action: 'Criar grupo',
    },
    {
      screen: 'group-created',
      title: 'Grupo criado',
      description:
        'O grupo já existe no WhatsApp. Copie o link de convite para chamar mais gente.',
      action: 'Copiar link',
    },
    {
      screen: 'group-chat',
      title: 'Converse pelo canal aberto',
      description:
        'Cada grupo vira uma conversa no canal aberto da linha, com o nome de quem escreveu em negrito. A resposta vai para o grupo.',
      action: 'Enviar',
    },
  ],
  done: {
    title: 'Grupo no Bitrix24',
    description:
      'Grupos de clientes, parceiros ou equipes, atendidos junto com o resto. Quer testar no seu portal?',
  },
}

/** Ordem das abas. */
export const TUTORIALS: Tutorial[] = [
  INSTALACAO,
  ATIVACAO,
  THINKBOT,
  API_OFICIAL,
  ROBOS,
  GRUPOS,
]

/** `link` opcional: âncora dentro da LP, mostrada depois da resposta. */
export const FAQ: {
  question: string
  answer: string
  link?: { href: string; label: string }
}[] = [
  {
    question: 'Preciso de um número novo?',
    answer:
      'Não. Você pode conectar o número que já usa, pelo WhatsApp Web, ou usar um número na API oficial do WhatsApp Business.',
  },
  {
    question: 'Qual a diferença entre WhatsApp Web e API oficial?',
    answer:
      'O WhatsApp Web conecta pelo QR Code e usa o aparelho como hoje. A API oficial é o canal homologado pela Meta, com templates aprovados e envio ativo em escala. O ThinkZap trabalha com os dois.',
  },
  {
    question: 'Funciona em qualquer plano do Bitrix24?',
    answer:
      'O ThinkZap usa as linhas abertas (Contact Center) do Bitrix24. Se o seu plano tem linhas abertas, ele funciona no seu portal.',
  },
  {
    question: 'Minha equipe precisa sair do Bitrix24 para responder?',
    answer:
      'Não. As mensagens chegam no chat das linhas abertas e ficam vinculadas ao contato e ao negócio no CRM.',
  },
  {
    question: 'Consigo testar antes de contratar?',
    answer:
      'Sim. Depois de instalar, você ativa um teste grátis de 3 dias direto na tela de Conexões, sem falar com ninguém. O teste é único por instalação.',
  },
  {
    question: 'O ThinkZap tem chatbot?',
    answer:
      'Tem. Com o ThinkBot você monta o fluxo de atendimento em blocos — perguntas, captura de dados, condições com base no CRM e transferência para um atendente —, testa no simulador e ativa em qualquer canal aberto do Bitrix24.',
    link: { href: '#tutorial-thinkbot', label: 'Ver o tutorial do ThinkBot' },
  },
]

export const FINAL_CTA = {
  title: 'Leve o WhatsApp para dentro do seu Bitrix24',
  subtitle:
    'Instale o ThinkZap pelo Market ou fale com nosso time para entender o melhor formato para sua operação.',
  fallback:
    'Procure o ThinkZap no Bitrix24 Market do seu portal para instalar.',
}
