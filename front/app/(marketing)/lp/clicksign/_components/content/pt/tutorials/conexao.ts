import type { Tutorial, ConexaoScreen } from '../../types'

const tutorial: Tutorial<ConexaoScreen> = {
  slug: 'conexao',
  label: 'Conectar Clicksign',
  summary:
    'Cadastre a conta da Clicksign que envia os documentos: token de acesso, ambiente e lembrete.',
  steps: [
    {
      screen: 'name',
      title: 'Dê um nome à empresa',
      description:
        'No app, em Configurações › Principal, a primeira empresa já vem em branco com o nome Nova Empresa. Troque pelo nome da sua conta: é ele que aparece no robô do Bitrix24. Cada empresa é uma conta da Clicksign — para cadastrar outra, clique em Nova Empresa.',
      action: 'Nome da empresa',
    },
    {
      screen: 'token',
      title: 'Cole o token de acesso',
      description:
        'No painel da Clicksign, copie o token de acesso da API da sua conta e cole em Token de Acesso. É ele que autoriza o envio pela sua conta.',
      action: 'Token de Acesso',
    },
    {
      screen: 'environment',
      title: 'Escolha o ambiente',
      description:
        'Produção envia documentos de verdade. Sandbox é o ambiente de testes da Clicksign. O token precisa ser do mesmo ambiente escolhido aqui.',
      action: 'Produção',
    },
    {
      screen: 'reminder',
      title: 'Defina o lembrete automático',
      description:
        'A Clicksign lembra quem ainda não assinou a cada 1, 2, 3, 7 ou 14 dias.',
      action: '3 dias',
    },
    {
      screen: 'save',
      title: 'Salve',
      description:
        'Clique em Salvar. Ao salvar, o app liga sozinho o retorno de status da Clicksign para o Bitrix24 — não é preciso configurar nada no painel da Clicksign.',
      action: 'Salvar',
    },
  ],
  done: {
    title: 'Clicksign conectada',
    description:
      'A conta está pronta para enviar. Agora prepare o Negócio com os campos que recebem o documento e o resultado da assinatura.',
  },
}

const screens = {}

export type ConexaoCopy = {
  tutorial: Tutorial<ConexaoScreen>
  screens: typeof screens
}

export const CONEXAO_PT: ConexaoCopy = { tutorial, screens }
