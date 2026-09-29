import type { Tutorial, AtivacaoScreen } from '../../types'

const tutorial: Tutorial<AtivacaoScreen> = {
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

/**
 * Textos das telas simuladas de `tutorials/ativacao.tsx`. O tipo sai daqui: a
 * versão em inglês precisa ter exatamente as mesmas chaves.
 */
const screens = {
  /** Convite do teste, usado nas telas `trial` e `contact`. */
  trial: {
    title: 'Teste o ThinkZap por 3 dias',
    description:
      'Escolha um tipo de conector para criar sua primeira linha. O teste é único por instalação e vale 3 dias.',
    oficialLabel: 'WhatsApp Oficial',
    start: 'Começar teste',
  },
  contact: {
    title: 'Confirme seus dados de contato',
    description:
      'Usamos esses dados para falar com você durante o teste. Confira e corrija se precisar.',
    fields: [
      { label: 'Seu nome', value: 'Joana Silva' },
      { label: 'E-mail', value: 'joana@empresa.com.br' },
      { label: 'Telefone', value: '(11) 99999-8888' },
      { label: 'Empresa', value: 'Acme LTDA' },
    ],
    cancel: 'Cancelar',
  },
  lines: {
    trialTitle: 'Teste em andamento',
    trialDescription:
      'Seu período de teste vai até sexta-feira. Depois disso a linha continua visível, mas para de enviar e receber mensagens.',
    rowSubtitle: 'Período de teste',
    rowStatus: 'Ativo',
  },
  /** Textos comuns às telas da linha (`qrcode`, `connected`, `channel`). */
  line: {
    device: 'Aparelho conectado: Joana Silva',
    connectionTitle: 'Conexão',
  },
  qrcode: {
    description: 'Leia o QR code com o WhatsApp do número desta linha.',
    instruction:
      'No WhatsApp: Aparelhos conectados → Conectar um aparelho, e aponte para o código.',
    refresh: 'Atualizar QR code',
  },
  connected: {
    description: 'Esta linha está conectada ao WhatsApp.',
    initials: 'JS',
    fields: [
      { label: 'Nome', value: 'Joana Silva' },
      { label: 'Telefone', value: '+55 11 99999-8888' },
      { label: 'Aparelho', value: 'iPhone' },
      { label: 'Conta', value: 'Business' },
    ],
    disconnectHint:
      'Desconectar encerra a sessão do WhatsApp desta linha. A assinatura não é afetada.',
    disconnect: 'Desconectar',
  },
  channel: {
    title: 'Canal aberto do Bitrix',
    description: 'É o vínculo que faz a mensagem chegar ao CRM.',
    empty: 'Nenhum canal vinculado. Sem vínculo, a mensagem não chega ao CRM.',
    selected: 'Vendas',
    behaviorTitle: 'Comportamento',
    prefixLabel: 'Prefixar nome do operador',
    prefixHint: 'Inclui o nome de quem atende antes da mensagem enviada.',
    openChannelLabel: 'Enviar para canal aberto',
    openChannelHint: 'Vincule um canal aberto para habilitar.',
  },
  chat: {
    chats: [
      { name: 'Maria Clara', detail: 'WhatsApp · Vendas' },
      { name: 'Rafael Souza', detail: 'WhatsApp · Vendas' },
    ],
    title: 'Maria Clara',
    subtitle: 'WhatsApp · Canal Vendas · Contato no CRM',
    incoming: 'Oi! Vi o anúncio de vocês. Tem horário amanhã?',
    reply: 'Temos sim, Maria! Às 10h ou às 15h?',
  },
}

export type AtivacaoCopy = {
  tutorial: Tutorial<AtivacaoScreen>
  screens: typeof screens
}

export const ATIVACAO_PT: AtivacaoCopy = { tutorial, screens }
