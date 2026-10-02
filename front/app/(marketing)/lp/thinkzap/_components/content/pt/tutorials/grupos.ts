import type { Tutorial, GruposScreen } from '../../types'

const tutorial: Tutorial<GruposScreen> = {
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

/**
 * Textos das telas simuladas de `tutorials/grupos.tsx`. O tipo sai daqui: a
 * versão em inglês precisa ter exatamente as mesmas chaves.
 */
const screens = {
  common: {
    device: 'Aparelho conectado: Joana Silva',
    groupName: 'Clientes VIP',
  },
  groupsTab: {
    description: 'Esta linha está conectada ao WhatsApp.',
    phoneLine: 'Telefone +55 11 99999-8888 · iPhone · Business',
  },
  groupsList: {
    title: 'Grupos do WhatsApp',
    colName: 'Nome',
    colLastActivity: 'Última interação',
    colActions: 'Ações',
    sampleGroup: 'Equipe de vendas',
    sampleLastActivity: 'ontem',
    rowActions: 'Editar · Sair',
  },
  groupForm: {
    title: 'Novo grupo',
    backToList: '← Voltar para lista',
    nameLabel: 'Nome do grupo',
    participants: 'Participantes',
    searchContact: 'Buscar contato no Bitrix',
    searchQuery: 'Maria',
    selectPhones: 'Selecione o(s) telefone(s)',
    addedParticipants: 'Participantes adicionados',
    autoInvite:
      'Enviar convite privado para participantes que não puderem ser adicionados diretamente',
    create: 'Criar grupo',
  },
  groupCreated: {
    success: 'Grupo criado com sucesso!',
    inviteLabel: 'Link de convite',
    copyLink: 'Copiar link',
    createAnother: 'Criar outro grupo',
    viewInList: 'Ver na lista',
  },
  groupChat: {
    groupDetail: 'Grupo WhatsApp · Vendas',
    otherChatDetail: 'WhatsApp · Vendas',
    subtitle: 'Grupo do WhatsApp · Canal Vendas',
    messages: [
      {
        author: 'Maria Clara',
        text: 'Oi, pessoal! Quando sai a nova coleção?',
      },
      { author: 'Rafael Souza', text: 'Também quero saber 👀' },
    ],
    reply: 'Na segunda-feira! Vocês recebem o catálogo aqui primeiro.',
  },
}

export type GruposCopy = {
  tutorial: Tutorial<GruposScreen>
  screens: typeof screens
}

export const GRUPOS_PT: GruposCopy = { tutorial, screens }
