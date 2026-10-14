import type { LpContent } from '../types'
import { ACOMPANHAMENTO_ES } from './tutorials/acompanhamento'
import { CONEXAO_ES } from './tutorials/conexao'
import { GRUPO_ES } from './tutorials/grupo'
import { INSTALACAO_ES } from './tutorials/instalacao'
import { NEGOCIO_ES } from './tutorials/negocio'
import { ROBO_ES } from './tutorials/robo'

// Trata por "tú" como `messages/es/clicksign`; robô e timeline só existem em português no portal.
export const ES: LpContent = {
  locale: 'es',
  htmlLang: 'es',
  metadata: {
    title: 'Clicksign — Firma electrónica integrada con Bitrix24',
    description:
      'Envía documentos de Bitrix24 para firma en Clicksign mediante un robot de automatización, sigue cada firma en la línea de tiempo de la negociación y recibe el PDF firmado de vuelta.',
    ogLocale: 'es_LA',
  },
  whatsappMessage:
    '¡Hola! Vengo de la página de la integración con Clicksign y quiero saber más sobre cómo firmar documentos desde Bitrix24.',
  nav: {
    features: 'Funcionalidades',
    tutorials: 'Tutoriales',
    faq: 'Preguntas',
    install: 'Instalar',
  },
  languageSwitch: { label: 'Idioma' },
  hero: {
    eyebrow: 'Clicksign dentro de Bitrix24',
    title: 'Contratos firmados sin salir de la negociación',
    subtitle:
      'Cuando la negociación llega a la etapa correcta, el documento va solo a Clicksign. Quien firma recibe la invitación, y el PDF firmado vuelve a Bitrix24.',
  },
  signPreview: {
    document: 'Contrato de servicio.pdf',
    sentFrom: 'Enviado por el robot en la etapa Contrato',
    deal: 'Negociación · Plan anual',
    signers: [
      { name: 'María Clara', signed: true },
      { name: 'Pablo Enrique', signed: true },
      { name: 'Lucía Torres', signed: false },
    ],
    signed: 'firmado',
    waiting: 'pendiente',
    signedFile: 'Archivo Firmado adjuntado',
  },
  features: {
    title: 'De la etapa del embudo al contrato firmado',
    subtitle:
      'Configúralo una vez y deja que cada negociación envíe su propio documento para firma.',
    items: [
      {
        icon: 'robot',
        title: 'Envío con el robot de Bitrix24',
        description:
          'El documento sale solo cuando la negociación entra en la etapa que elijas, con el robot Enviar documento.',
      },
      {
        icon: 'mapping',
        title: 'Los campos de tu negociación',
        description:
          'Tú eliges de qué campo sale el documento y dónde guardar el ID, el estado, la fecha y el PDF firmado.',
      },
      {
        icon: 'groups',
        title: 'Grupos de firma',
        description:
          'Un grupo para cada tipo de documento, con los contactos de la negociación y personas de tu equipo, en el orden que definas.',
      },
      {
        icon: 'auth',
        title: 'Verificación de quien firma',
        description:
          'Código por email, SMS o WhatsApp y, si quieres, selfie, documento oficial, firma manuscrita o biometría facial.',
      },
      {
        icon: 'timeline',
        title: 'Seguimiento en la línea de tiempo',
        description:
          'Una tarjeta en la negociación muestra quién ya firmó y se actualiza con cada firma.',
      },
      {
        icon: 'signedFile',
        title: 'PDF firmado en la negociación',
        description:
          'Cuando todos firman, el documento final se adjunta solo a la negociación.',
      },
      {
        icon: 'companies',
        title: 'Varias cuentas de Clicksign',
        description:
          'Registra más de una empresa y elige en cada robot desde qué cuenta enviar.',
      },
      {
        icon: 'cancel',
        title: 'Rechazo y cancelación',
        description:
          'Permite rechazar con un motivo y cancela un envío directamente desde la tarjeta, con todo registrado en la línea de tiempo.',
      },
    ],
  },
  tutorialsSection: {
    title: 'Tutoriales',
    subtitle:
      'Simulaciones del recorrido real, dentro de Bitrix24. Elige un tema y haz clic en el resaltado naranja para avanzar.',
  },
  player: {
    tabsLabel: 'Tutoriales',
    variantsLabel: tutorial => `Tipos de ${tutorial.toLowerCase()}`,
    done: 'Listo',
    stepOf: (step, total) => `Paso ${step} de ${total}`,
    hint: 'Haz clic en el resaltado naranja de la pantalla:',
    back: 'Atrás',
    next: 'Siguiente',
    finish: 'Finalizar',
    goToStep: (step, title) => `Ir al paso ${step}: ${title}`,
    restart: 'Ver de nuevo',
    nextTutorial: label => `Siguiente tutorial: ${label}`,
  },
  frame: {
    bitrixMenu: {
      crm: 'CRM',
      openChannels: 'Canales abiertos',
      app: 'ClickSign',
      market: 'Market',
    },
    appMenu: {
      configuracoes: 'Configuración',
      assinatura: 'Grupos de firma',
      logs: 'Logs',
      ajuda: 'Ayuda',
    },
    poweredBy: 'Desarrollado por CRMThink',
    beta: 'Versión Beta',
    portalHost: 'tuempresa.bitrix24.es',
  },
  shared: {
    select: 'Seleccionar…',
    configuracoes: {
      tabPrincipal: 'Principal',
      tabExtra: 'Extra',
      companiesTitle: 'Configuración de Empresas',
      companiesDescription:
        'Gestiona la configuración de integración con Clicksign',
      newCompany: 'Nueva Empresa',
      tokenLabel: 'Token de Acceso',
      tokenHint: 'Token de autenticación de la API de Clicksign',
      tokenPlaceholder: 'Pega el token de Clicksign',
      environmentLabel: 'Entorno',
      environmentHint: 'Entorno de integración con Clicksign',
      environments: { prod: 'Producción', sandbox: 'Sandbox' },
      reminderLabel: 'Recordatorio Automático',
      reminderHint: 'Frecuencia de los recordatorios de firma',
      reminderDays: days => (days === 1 ? '1 día' : `${days} días`),
      save: 'Guardar',
      additionalTitle: 'Configuración Adicional',
      extras: {
        selfie: 'Usar Selfie como autenticación',
        facialBiometrics:
          'Usar biometría facial como punto de autenticación adicional para el firmante',
        handwritten:
          'Usar firma manuscrita como punto de autenticación en el momento de la firma',
        officialDocument:
          'Solicitar la foto (frente y reverso) del documento oficial',
        rubrica: 'Solicitar rúbrica (es necesario activar la función de sobre)',
      },
      facialBiometricsHint:
        'Costo adicional de R$ 1,50 por biometría facial realizada con éxito (cobrado por Clicksign).',
      contactFieldsTitle: 'Campos de Contacto',
      contactFieldsDescription:
        'Este mapeo es obligatorio cuando el firmante del grupo de firma es el "Contacto predeterminado" del negocio.',
      cpfLabel: 'CPF',
      isForeignLabel: '¿Es extranjero?',
      signAsLabel: 'Firmar como',
      signAsValue: '[Clicksign] Firmar como',
      signAsHint: 'Campo creado en la instalación de la APP (no eliminar)',
    },
    assinatura: {
      title: 'Configuración de Firmas',
      description:
        'Configura los grupos de firma y sus respectivos campos en Bitrix24',
      save: 'Guardar',
      newGroup: 'Nuevo Grupo',
      empty: 'Ningún grupo de firma. Haz clic en “Nuevo Grupo” para empezar.',
      group: 'Grupo',
      groupIdPlaceholder: 'Identificador del grupo',
      dealFields: 'Campos del Negocio',
      fields: {
        arquivo: {
          label: 'Archivo para Firma',
          hint: 'Campo que contiene el archivo a firmar',
        },
        dataLimite: {
          label: 'Fecha Límite',
          hint: 'Fecha límite para la firma del documento',
        },
        documentoId: {
          label: 'ID del Documento',
          hint: 'Campo para almacenar el ID del documento en Clicksign',
        },
        status: {
          label: 'Estado de Firma',
          hint: 'Campo que indica si el documento fue firmado',
        },
        finalizado: {
          label: 'Proceso Finalizado',
          hint: 'Campo que indica si el proceso de firma fue concluido',
        },
        dataAssinatura: {
          label: 'Fecha de Firma',
          hint: 'Fecha en que se firmó el documento',
        },
        arquivoAssinado: {
          label: 'Archivo Firmado',
          hint: 'Campo donde se guardará el documento firmado',
        },
      },
      contactsTitle: 'Configuración de Contactos',
      addContact: 'Agregar Contacto',
      participantsTitle: 'Participantes',
      add: 'Agregar',
      useDefaultContact: 'Usar el contacto predeterminado del negocio',
      useDefaultContactHint:
        'Si está desactivado, puedes seleccionar campos personalizados',
      userLabel: 'Usuario',
      userHint: 'Selecciona un usuario fijo o usa un campo de Bitrix',
      roleLabel: 'Función',
      emailLabel: 'Email',
      emailPlaceholder: 'Email del participante',
      isForeign: 'Es extranjero',
    },
    crm: {
      dealsTitle: 'Negociaciones',
      filterSearch: 'Filtro y búsqueda',
      stages: {
        novo: 'Nueva',
        proposta: 'Propuesta enviada',
        contrato: 'Contrato',
        ganho: 'Negociación ganada',
      },
      fieldKinds: { file: 'Archivo', date: 'Fecha', text: 'Cadena' },
      dealLabel: (id, value) => `Negociación #${id} · ${value}`,
      about: 'Acerca de la negociación',
      timeline: 'Línea de tiempo',
      empty: 'sin completar',
    },
    card: {
      title: '[Clicksign]',
      intro: 'Documento enviado para firma',
      header: (documentId, group) => `Documento ${documentId} - ${group}`,
      canceledHeader: documentId => `Documento ${documentId}`,
      status: {
        progress: 'En curso',
        finished: 'Finalizado',
        refused: 'Rechazado',
        canceled: 'Cancelado',
      },
      signer: {
        waiting: 'Pendiente',
        signed: 'Firmado',
        refused: 'Rechazado',
      },
      cancel: 'Cancelar documento',
    },
    sample: {
      companyName: 'Acme S.A.',
      companyDraft: 'Nueva Empresa',
      token: 'a3f1c9e2-7b4d-4e8a-9c21-5d6e0f7a8b90',
      groupId: 'Contrato de servicio',
      documentId: '8e2b…41f0',
      deal: {
        title: 'Plan anual',
        contact: 'María Clara',
        value: 'R$ 12.000,00',
      },
      signers: [
        { name: 'Ana Souza', email: 'ana@tuempresa.com' },
        { name: 'María Clara', email: 'maria@cliente.com' },
      ],
      user: 'Ana Souza',
      role: 'Firmar como contratante',
      fileName: 'contrato-servicio.pdf',
      signedFileName: 'contrato-servicio-firmado.pdf',
      signedAt: '14/10/2026',
      yes: 'Sí',
      cpfField: 'CPF',
      foreignField: 'Extranjero',
    },
  },
  tutorials: {
    instalacao: INSTALACAO_ES,
    conexao: CONEXAO_ES,
    negocio: NEGOCIO_ES,
    grupo: GRUPO_ES,
    robo: ROBO_ES,
    acompanhamento: ACOMPANHAMENTO_ES,
  },
  faq: {
    title: 'Preguntas frecuentes',
    items: [
      {
        question:
          'Apareció "Documento no adjuntado a la negociación" o "No se pudo descargar el archivo adjunto". ¿Qué hago?',
        answer:
          'El robot no encontró el documento en la negociación. Adjunta el archivo en el campo elegido en Archivo para Firma del grupo — solo cuenta el primer archivo, en PDF, DOC, DOCX, PNG o JPG. Si el archivo ya estaba ahí, vuelve a adjuntarlo. Después ejecuta el robot otra vez, sacando la negociación de la etapa y regresándola.',
        link: {
          href: '#tutorial-grupo',
          label: 'Ver el tutorial del grupo de firma',
        },
      },
      {
        question:
          'Apareció "No se encontró ningún firmante para el grupo seleccionado".',
        answer:
          'El grupo no encontró a nadie para firmar. Revisa que los campos de nombre y email de quien firma estén completos en la negociación y que el grupo apunte a los campos correctos. Con "Usar el contacto predeterminado del negocio" activado, la negociación debe tener al menos un contacto vinculado. Corrígelo y vuelve a ejecutar el robot.',
        link: {
          href: '#tutorial-grupo',
          label: 'Ver el tutorial del grupo de firma',
        },
      },
      {
        question: 'El robot se ejecutó y no pasó nada. ¿Desapareció el grupo?',
        answer:
          'Si el grupo se renombró o se eliminó, el robot sigue apuntando al anterior y el envío se detiene sin aviso en la línea de tiempo — el motivo queda en Logs, en la app. En Grupos de firma, haz clic en Guardar, abre el robot en Bitrix24 y vuelve a elegir el grupo.',
        link: {
          href: '#tutorial-robo',
          label: 'Ver el tutorial del robot de envío',
        },
      },
      {
        question: 'Cambié la empresa o el token y el envío se detuvo.',
        answer:
          'El robot guarda la empresa que se eligió en él. Después de cambiar el token o eliminar la empresa, guarda la Configuración, abre el robot y vuelve a elegir la Empresa.',
        link: {
          href: '#tutorial-robo',
          label: 'Ver el tutorial del robot de envío',
        },
      },
      {
        question: 'Clicksign rechazó el envío. ¿Por qué?',
        answer:
          'El mensaje de Clicksign aparece en un comentario [Clicksign] en la línea de tiempo de la negociación y en Logs, en la app. Las causas más comunes son un token inválido o vencido, un token de un entorno con el otro elegido en Entorno (Producción × Sandbox) y los límites de tu cuenta en Clicksign. Corrígelo en Configuración, guarda y vuelve a ejecutar el robot.',
        link: {
          href: '#tutorial-conexao',
          label: 'Ver el tutorial de conexión con Clicksign',
        },
      },
      {
        question: 'El documento se firmó, pero el estado no vuelve a Bitrix24.',
        answer:
          'En Configuración, revisa que el token y el Entorno sean correctos y haz clic en Guardar de nuevo: al guardar, la app vuelve a activar sola el retorno de estado de Clicksign. No hace falta configurar nada en el panel de Clicksign.',
        link: {
          href: '#tutorial-conexao',
          label: 'Ver el tutorial de conexión con Clicksign',
        },
      },
      {
        question: 'Todos firmaron, pero el PDF no se adjuntó a la negociación.',
        answer:
          'La app vuelve a intentarlo sola durante un tiempo. Revisa que el campo elegido en Archivo Firmado sea de tipo archivo y que el documento tenga hasta 25 MB. Si es más grande, descarga el PDF firmado en el panel de Clicksign y adjúntalo a la negociación manualmente.',
        link: {
          href: '#tutorial-acompanhamento',
          label: 'Ver el tutorial de seguimiento',
        },
      },
      {
        question: 'No pude cancelar el documento.',
        answer:
          'Un documento ya firmado por todos, finalizado o vencido no se puede cancelar, y la línea de tiempo muestra un comentario con el motivo. Revisa su estado en el panel de Clicksign. Si fue una falla pasajera, vuelve a hacer clic en Cancelar documento.',
      },
      {
        question:
          '¿La negociación cambia de etapa sola cuando se firma el documento?',
        answer:
          'No. La app completa Estado de Firma, Fecha de Firma, Proceso Finalizado y Archivo Firmado en la negociación. Para mover la negociación, crea tu propia automatización en Bitrix24 a partir del cambio de esos campos.',
        link: {
          href: '#tutorial-acompanhamento',
          label: 'Ver el tutorial de seguimiento',
        },
      },
      {
        question: 'El robot se ejecutó antes de que guardara la Configuración.',
        answer:
          'Sin empresa y token guardados, el robot no tiene desde qué cuenta enviar y nada llega a Clicksign. Registra la empresa en Configuración, guarda, arma el grupo de firma y vuelve a ejecutar el robot.',
        link: {
          href: '#tutorial-conexao',
          label: 'Ver el tutorial de conexión con Clicksign',
        },
      },
    ],
  },
  finalCta: {
    title: 'Firma contratos sin salir de Bitrix24',
    subtitle:
      'Instala la integración con Clicksign desde el Market o habla con nuestro equipo para armar el flujo de firma de tu operación.',
    fallback:
      'Busca Clicksign en el Bitrix24 Market de tu portal para instalarla.',
  },
  ctaButtons: {
    install: 'Instalar en Bitrix24',
    whatsapp: 'Hablar por WhatsApp',
  },
  footer: year => `Clicksign · Firma electrónica para Bitrix24 · © ${year}`,
}
