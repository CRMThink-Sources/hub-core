import type { Tutorial, AcompanhamentoScreen } from '../../types'

const tutorial: Tutorial<AcompanhamentoScreen> = {
  slug: 'acompanhamento',
  label: 'Acompanhar e cancelar',
  summary:
    'Tudo volta para a timeline do negócio: quem já assinou, o PDF assinado, recusas e cancelamentos.',
  steps: [
    {
      screen: 'sent',
      title: 'Acompanhe pelo card',
      description:
        'Na timeline do negócio aparece o card [Clicksign] com o documento e o grupo, a etiqueta Em andamento e cada pessoa que assina como Aguardando.',
      action: 'Em andamento',
    },
    {
      screen: 'signed',
      title: 'Veja quem já assinou',
      description: 'A cada assinatura, a linha da pessoa passa para Assinado.',
      action: 'Assinado',
    },
    {
      screen: 'finished',
      title: 'Receba o documento assinado',
      description:
        'Quando todos assinam, o card fica Finalizado e o PDF assinado é anexado em Arquivo Assinado (até 25 MB). Status de Assinatura, Data de Assinatura e Processo Finalizado são preenchidos. O negócio não muda de etapa sozinho: se quiser, crie sua própria automação a partir desses campos.',
      action: 'Arquivo Assinado',
    },
    {
      screen: 'refused',
      title: 'Se alguém recusar',
      description:
        'Se o robô permitir a recusa, a timeline mostra Documento recusado, com quem recusou e o motivo, e o card fica Recusado.',
      action: 'Documento recusado',
    },
    {
      screen: 'cancel',
      title: 'Cancele pelo card',
      description:
        'Precisa desistir do envio? Clique em Cancelar documento no card. Documento já finalizado não pode mais ser cancelado.',
      action: 'Cancelar documento',
    },
    {
      screen: 'canceled',
      title: 'Cancelamento registrado',
      description:
        'O card fica Cancelado e a timeline registra Cancelamento de documento, com quem cancelou e quando.',
      action: 'Cancelamento de documento',
    },
    {
      screen: 'error',
      title: 'Se algo der errado',
      description:
        'Quando o envio não acontece, a timeline ganha um comentário começando por [Clicksign] com o motivo — por exemplo, Documento não anexado ao negócio. Corrija e rode o robô de novo, tirando o negócio da etapa e voltando.',
      action: 'Comentário da Clicksign',
    },
  ],
  done: {
    title: 'Tudo sob controle',
    description:
      'Do envio ao PDF assinado, sem sair do Bitrix24. Ficou alguma dúvida? Veja as perguntas frequentes abaixo.',
  },
}

const screens = {
  refusedLog: {
    title: '[Clicksign] Documento recusado',
    by: (name: string, when: string) => `Recusado por ${name} em ${when}`,
    reasons: 'Motivo(s): Dados incorretos',
    comment: 'Descrição: O endereço do contrato está errado.',
  },
  canceledLog: {
    title: '[Clicksign] Cancelamento de documento',
    by: (name: string, when: string) =>
      `Cancelamento realizado por ${name} em ${when}`,
  },
  errorComment: '[Clicksign] Documento não anexado ao negócio',
  when: '14/10/2026 10:32',
}

export type AcompanhamentoCopy = {
  tutorial: Tutorial<AcompanhamentoScreen>
  screens: typeof screens
}

export const ACOMPANHAMENTO_PT: AcompanhamentoCopy = { tutorial, screens }
