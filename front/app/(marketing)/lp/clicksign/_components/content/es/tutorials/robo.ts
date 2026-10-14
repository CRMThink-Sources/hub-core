import type { RoboCopy } from '../../pt/tutorials/robo'

export const ROBO_ES: RoboCopy = {
  tutorial: {
    slug: 'robo',
    label: 'Robot de envío',
    summary:
      'El documento solo se envía con el robot Enviar documento, en una etapa del embudo de Negociaciones.',
    steps: [
      {
        screen: 'kanban',
        title: 'Abre las reglas de automatización',
        description:
          'En el CRM de Bitrix24, en Negociaciones, haz clic en Reglas de automatización. El robot de Clicksign ya viene instalado con la app y solo funciona en Negociaciones.',
        action: 'Reglas de automatización',
      },
      {
        screen: 'stages',
        title: 'Elige la etapa',
        description:
          'El documento sale cuando la negociación entra en la etapa. Haz clic en el + de la etapa "Contrato".',
        action: 'Agregar robot en Contrato',
      },
      {
        screen: 'catalog',
        title: 'Elige el robot de Clicksign',
        description:
          'En la ventana Agregar, busca "clicksign" y haz clic en Agregar en [Clicksign] Enviar documento.',
        action: '[Clicksign] Enviar documento',
      },
      {
        screen: 'robot-token',
        title: 'Elige cómo llega el código',
        description:
          'En Envío del token, elige por dónde recibe quien firma el código de confirmación: Email, SMS o WhatsApp.',
        action: 'Envío del token',
      },
      {
        screen: 'robot-group',
        title: 'Elige el grupo',
        description:
          'En Grupo de firma, elige el grupo creado en la app. ¿No aparece? Guarda los grupos en la app y vuelve a abrir el robot.',
        action: 'Grupo de firma',
      },
      {
        screen: 'robot-sequence',
        title: 'Define el orden y el rechazo',
        description:
          'En Activar secuencia, Sí hace que firmen de a uno — primero los participantes, después los contactos — y se ignoran los números de Grupo. No sigue los números de Grupo. En ¿Permitir rechazo?, indica si quien firma puede rechazar.',
        action: 'Activar secuencia',
      },
      {
        screen: 'robot-save',
        title: 'Elige la empresa y guarda',
        description:
          'En Empresa, elige la cuenta de Clicksign que envía el documento y haz clic en Guardar.',
        action: 'Guardar',
      },
      {
        screen: 'move-deal',
        title: 'Mueve una negociación',
        description:
          'Cuando una negociación entra en "Contrato", el archivo del campo Archivo para Firma va a Clicksign y quien firma recibe la invitación.',
        action: 'Mover a Contrato',
      },
    ],
    done: {
      title: 'Envío automático activo',
      description:
        'Cada negociación que llega a la etapa envía su propio documento. A continuación, mira cómo seguir las firmas.',
    },
  },
  screens: {
    robot: '[Clicksign] Enviar documento',
    board: {
      extensions: 'Extensiones',
      rules: 'Reglas de automatización',
      otherDeals: [
        {
          title: 'Remodelación de oficina',
          contact: 'Rafael Souza',
          value: 'R$ 8.900,00',
        },
        { title: 'Consultoría', contact: 'Ana Prado', value: 'R$ 4.500,00' },
      ],
    },
    stages: {
      title: 'Reglas de automatización · Negociaciones',
      hint: 'Los robots se ejecutan cuando la negociación entra en la etapa.',
    },
    catalog: {
      title: 'Agregar',
      toStage: 'a la etapa',
      search: 'clicksign',
      rules: 'Reglas de automatización y disparadores',
      description: 'Enviar documento para firma',
      add: 'Agregar',
    },
    robotForm: {
      token: 'Envío del token',
      tokenValue: 'Email',
      group: 'Grupo de firma',
      sequence: 'Activar secuencia',
      sequenceValue: 'No',
      refusable: '¿Permitir rechazo?',
      refusableValue: 'No',
      company: 'Empresa',
      runWhen: (stage: string) =>
        `Ejecutar: cuando la negociación entre en la etapa "${stage}"`,
      save: 'Guardar',
      cancel: 'Cancelar',
    },
  },
}
