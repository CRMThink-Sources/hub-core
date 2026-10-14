import type { Tutorial, GrupoScreen } from '../../types'

const tutorial: Tutorial<GrupoScreen> = {
  slug: 'grupo',
  label: 'Grupo de assinatura',
  summary:
    'O grupo diz em qual campo está o documento, onde gravar o retorno e quem assina.',
  steps: [
    {
      screen: 'new-group',
      title: 'Crie um grupo',
      description:
        'No app, em Grupos de assinatura, clique em Novo Grupo. Você pode ter um grupo para cada tipo de documento.',
      action: 'Novo Grupo',
    },
    {
      screen: 'group-id',
      title: 'Dê um nome ao grupo',
      description:
        'O identificador é o nome que você escolhe depois no robô do Bitrix24.',
      action: 'Identificador do grupo',
    },
    {
      screen: 'deal-fields',
      title: 'Ligue os campos do Negócio',
      description:
        'Em Campos do Negócio, escolha os campos criados no tutorial anterior. Em Arquivo para Assinatura vale só o primeiro arquivo do campo, em PDF, DOC, DOCX, PNG ou JPG.',
      action: 'Arquivo para Assinatura',
    },
    {
      screen: 'default-contact',
      title: 'Defina quem assina',
      description:
        'Em Configuração de Contatos, o grupo novo já vem com um contato; Adicionar Contato inclui outros. Com Usar contato padrão do negócio ligado, todos os contatos do negócio assinam, com o CPF do campo escolhido na aba Extra. Desligado, você aponta os campos do Negócio com o nome, o e-mail e o CPF de quem assina. Em Grupo (1 a 10) fica a ordem de assinatura.',
      action: 'Usar contato padrão do negócio',
    },
    {
      screen: 'add-participant',
      title: 'Inclua alguém da sua equipe',
      description:
        'Em Participantes, clique em Adicionar para incluir um usuário do Bitrix24 que também assina — um gestor ou uma testemunha, por exemplo.',
      action: 'Adicionar',
    },
    {
      screen: 'participant',
      title: 'Escolha o usuário e a função',
      description:
        'Escolha um Usuário fixo ou um Campo de Usuário do negócio (como o responsável), a Função com que ele assina e o Grupo.',
      action: 'Função',
    },
    {
      screen: 'save',
      title: 'Salve',
      description:
        'Clique em Salvar. Criou, renomeou ou apagou um grupo ou uma empresa? Salve e abra o robô de novo, para as listas dele se atualizarem.',
      action: 'Salvar',
    },
  ],
  done: {
    title: 'Grupo pronto',
    description:
      'Falta só o robô: é ele que envia o documento quando o negócio chega na etapa certa.',
  },
}

const screens = {}

export type GrupoCopy = {
  tutorial: Tutorial<GrupoScreen>
  screens: typeof screens
}

export const GRUPO_PT: GrupoCopy = { tutorial, screens }
