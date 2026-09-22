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

/** Tela simulada de cada passo; o componente desenha uma por id. */
export type WalkthroughScreen =
  | 'market'
  | 'install'
  | 'trial'
  | 'contact'
  | 'lines'
  | 'qrcode'
  | 'connected'
  | 'channel'
  | 'chat'

/**
 * Passo a passo simulado da instalação e configuração. Espelha o fluxo e os
 * textos reais do app: Market → instalação → Conexões (teste) → configuração da
 * linha (abas Conexão e Ajustes) → chat do canal aberto. Se o fluxo mudar, mude
 * aqui e em `walkthrough-screens.tsx`. `action` é o rótulo acessível do elemento
 * destacado que o visitante clica.
 */
export const WALKTHROUGH: {
  screen: WalkthroughScreen
  title: string
  description: string
  action: string
}[] = [
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
]

export const WALKTHROUGH_DONE = {
  title: 'Pronto! Seu WhatsApp está no Bitrix24',
  description:
    'Foi isso: instalar, conectar e atender. Quer fazer no seu portal?',
}

export const FAQ: { question: string; answer: string }[] = [
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
]

export const FINAL_CTA = {
  title: 'Leve o WhatsApp para dentro do seu Bitrix24',
  subtitle:
    'Instale o ThinkZap pelo Market ou fale com nosso time para entender o melhor formato para sua operação.',
  fallback:
    'Procure o ThinkZap no Bitrix24 Market do seu portal para instalar.',
}
