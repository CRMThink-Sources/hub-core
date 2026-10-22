import type { HomeContent } from './types'

export const es: HomeContent = {
  locale: 'es',
  htmlLang: 'es',
  metadata: {
    title: 'Think Hub — Apps de CRMThink para Bitrix24',
    description:
      'WhatsApp, firma electrónica, importación de hojas de cálculo, BI y agentes de IA dentro de tu Bitrix24. Conoce las apps de Think Hub.',
    ogLocale: 'es_ES',
  },
  languageSwitch: { label: 'Idioma' },
  nav: { apps: 'Apps', why: 'Por qué Think Hub', cta: 'Ver las apps' },
  hero: {
    eyebrow: 'Apps de CRMThink para Bitrix24',
    title: 'Todo lo que tu Bitrix24 aún no hace,',
    highlight: 'conectado en un solo lugar',
    subtitle:
      'Think Hub reúne las apps de CRMThink: WhatsApp en el canal abierto, contratos firmados desde la negociación, hojas de cálculo importadas al CRM, datos externos en el BI y agentes de IA atendiendo a tus clientes.',
    primary: 'Conocer las apps',
    secondary: 'Por qué Think Hub',
    diagramLabel: 'Las apps de Think Hub conectadas a Bitrix24',
  },
  apps: {
    title: 'Elige la app para tu desafío',
    subtitle:
      'Cada app resuelve una parte del proceso y funciona dentro de Bitrix24, sin cambiar de pantalla.',
    learnMore: name => `Conocer ${name}`,
    comingSoon: 'Página próximamente',
    items: {
      thinkzap: {
        tagline: 'WhatsApp dentro de Bitrix24',
        description:
          'Atiende por WhatsApp en los canales abiertos y envía mensajes desde los robots del CRM.',
        highlights: [
          'API oficial y WhatsApp Web',
          'Plantillas y mensajes con botones',
          'Envío desde los robots del embudo',
        ],
      },
      clicksign: {
        tagline: 'Firma electrónica en la negociación',
        description:
          'Genera y envía contratos para firma desde la etapa del embudo y síguelo todo en la línea de tiempo.',
        highlights: [
          'Documento con los campos de la negociación',
          'Grupos y orden de firma',
          'PDF firmado de vuelta en el CRM',
        ],
      },
      importsheet: {
        tagline: 'Hojas de cálculo directo al CRM',
        description:
          'Importa hojas de Google a Bitrix24 con mapeo de campos y programación.',
        highlights: [
          'Conexión con Google Sheets',
          'Mapeo de columnas a campos',
          'Importaciones programadas',
        ],
      },
      thinkanalise: {
        tagline: 'Datos externos en el BI de Bitrix24',
        description:
          'Conecta APIs de otros sistemas y lleva los datos a datasets del BI Builder.',
        highlights: [
          'Conexiones de API configurables',
          'Datasets en el BI Builder',
          'Logs de cada sincronización',
        ],
      },
      gptmaker: {
        tagline: 'Agentes de IA en la atención',
        description:
          'Pon un agente de IA a atender en los canales abiertos, consultar el CRM y transferir a humanos.',
        highlights: [
          'Atención en los canales abiertos',
          'Consulta y registro en el CRM',
          'Transferencia al operador',
        ],
      },
    },
  },
  why: {
    title: 'Por qué Think Hub',
    subtitle:
      'Apps pensadas para quien ya trabaja en Bitrix24 y no quiere abrir otra herramienta más.',
    items: [
      {
        icon: 'bitrix',
        title: 'Dentro de Bitrix24',
        description:
          'Las apps aparecen en el CRM, en los canales abiertos y en los robots que tu equipo ya usa.',
      },
      {
        icon: 'market',
        title: 'Instalación desde el Market',
        description:
          'Instala desde el Bitrix24 Market y configura en pocos pasos, con tutoriales en cada página.',
      },
      {
        icon: 'support',
        title: 'Hecho por un partner de Bitrix24',
        description:
          'Desarrollado y mantenido por CRMThink, con soporte de quien implementa Bitrix24 todos los días.',
      },
      {
        icon: 'languages',
        title: 'Portugués, inglés y español',
        description: 'Interfaces y contenidos en los idiomas de tu operación.',
      },
    ],
  },
  finalCta: {
    title: 'Empieza por la app que más te hace falta hoy',
    subtitle:
      'Cada app tiene su página con funcionalidades, tutoriales y el enlace de instalación.',
    button: 'Ver las apps',
  },
  footer: year => `© ${year} CRMThink. Todos los derechos reservados.`,
}
