import type { Tutorial, ThinkbotScreen } from '../../types'

const tutorial: Tutorial<ThinkbotScreen> = {
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

/**
 * Textos das telas simuladas de `tutorials/thinkbot.tsx`. O tipo sai daqui: a
 * versão em inglês precisa ter exatamente as mesmas chaves.
 */
const screens = {
  list: {
    title: 'ThinkBot',
    subtitle:
      'Monte o fluxo de atendimento: defina como o bot deve conduzir a conversa.',
    emptyTitle: 'Nenhum fluxo criado',
    create: 'Criar fluxo',
  },
  newFlow: {
    title: 'Novo fluxo',
    description: 'Defina um nome para identificar este fluxo internamente.',
    nameLabel: 'Nome',
    cancel: 'Cancelar',
  },
  bind: {
    inert: (name: string) =>
      `"${name}" está publicada mas ainda não atende ninguém — escolha um canal aberto em "Atende em".`,
    columns: { flow: 'Fluxo', status: 'Situação', servesOn: 'Atende em' },
    published: 'Publicada',
    channel: 'Vendas',
    activate: 'ativar',
  },
  editor: {
    unsaved: 'não salvo',
    newBlock: 'Novo bloco',
    rearrange: 'Reorganizar',
    tabs: { simulador: 'simulador', ajustes: 'ajustes' },
    save: 'Salvar',
    publish: 'Publicar',
    legend:
      'Clique no + para adicionar o próximo passo · clique no bloco para editar · clique na linha e Delete apaga',
    problem: 'Deste bloco não se chega a um encerramento nem a um atendente.',
    entry: 'início',
  },
  kinds: {
    message: 'Mensagem',
    question: 'Pergunta',
    input: 'Captura',
    condition: 'Condição',
    handoff: 'Transferir',
    finish: 'Encerrar',
  },
  kindMenu: {
    title: 'Qual a interação que deseja?',
    groups: { conversa: 'Conversa', acoes: 'Ações do chat' },
    ready: 'Prontos',
    recipes: ['Já é cliente?', 'Tem negócio aberto?'],
  },
  /** O fluxo de exemplo, repetido no editor, no simulador e no chat. */
  flow: {
    name: 'Atendimento geral',
    welcome: 'Olá! Sou o atendimento automático. Como posso ajudar?',
    question: 'Sobre o que você quer falar?',
    handoff: 'Conversa passada para um atendente.',
    blocks: {
      welcome: 'Boas-vindas',
      menu: 'Menu',
      agent: 'Atendente',
      agentText: 'Fila do canal aberto',
      bye: 'Tchau',
      byeText: 'Até logo!',
    },
    options: {
      support: { label: 'Suporte', keywords: 'ajuda, problema' },
      finish: { label: 'Encerrar', keywords: 'sair, tchau' },
    },
  },
  blockPanel: {
    blockName: 'Nome do bloco',
    questionLabel: 'O que o bot pergunta',
    options: 'Opções',
    keywords: 'palavras-chave:',
    leadsTo: 'leva para',
    addOption: '+ opção',
  },
  simulator: {
    title: 'Simulador',
    notice: 'não envia nada ao cliente',
    empty: 'Rode o fluxo como se você fosse o cliente no WhatsApp.',
    start: 'Iniciar conversa',
    placeholder: 'Resposta do cliente',
  },
  botChat: {
    chats: [
      { name: 'Carlos Lima', detail: 'WhatsApp · Vendas' },
      { name: 'Maria Clara', detail: 'WhatsApp · Vendas' },
    ],
    title: 'Carlos Lima',
    subtitle: 'WhatsApp · Canal Vendas · Contato no CRM',
    incoming: 'Oi, meu pedido ainda não chegou',
    reply: 'Oi, Carlos! Sou a Joana, já vou verificar seu pedido.',
  },
}

export type ThinkbotCopy = {
  tutorial: Tutorial<ThinkbotScreen>
  screens: typeof screens
}

export const THINKBOT_PT: ThinkbotCopy = { tutorial, screens }
