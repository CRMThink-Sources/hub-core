import type { LpContent } from '../types'
import { AGENDAMENTO_ES } from './tutorials/agendamento'
import { ERROS_ES } from './tutorials/erros'
import { GOOGLE_ES } from './tutorials/google'
import { INSTALACAO_ES } from './tutorials/instalacao'
import { MAPEAMENTO_ES } from './tutorials/mapeamento'
import { NOVA_IMPORTACAO_ES } from './tutorials/nova-importacao'

// Trata por "usted" como `messages/es/importsheet`.
export const ES: LpContent = {
  locale: 'es',
  htmlLang: 'es',
  metadata: {
    title: 'ImportSheet — Google Sheets integrado con Bitrix24',
    description:
      'Importe hojas de cálculo de Google Sheets a Bitrix24: prospectos, negociaciones, contactos, compañías, SPAs, tareas y Livefeed, con asignación de columnas, programación y sin registros duplicados.',
    ogLocale: 'es_LA',
  },
  whatsappMessage:
    '¡Hola! Vengo de la página de ImportSheet y quiero saber más sobre cómo importar hojas de cálculo de Google a Bitrix24.',
  nav: {
    features: 'Funcionalidades',
    tutorials: 'Tutoriales',
    faq: 'Preguntas',
    install: 'Instalar',
  },
  languageSwitch: { label: 'Idioma' },
  hero: {
    eyebrow: 'Google Sheets dentro de Bitrix24',
    title:
      'Su hoja de Google se convierte en registros del CRM, sin copiar y pegar',
    subtitle:
      'ImportSheet lee las filas de su hoja de cálculo y crea o actualiza prospectos, negociaciones, contactos, compañías y SPAs en Bitrix24 — al instante o en el horario que usted programe.',
  },
  sheetPreview: {
    columns: ['Pedido', 'Cliente', 'Valor'],
    rows: [
      ['1042', 'María Clara', '$2.400'],
      ['1043', 'Pablo Enrique', '$980'],
      ['1044', 'Lucía Torres', '$5.150'],
    ],
    entity: 'Negociaciones',
    created: 'creado',
    updated: 'actualizado',
  },
  features: {
    title: 'De la hoja de cálculo al CRM, sin retrabajo',
    subtitle:
      'Configúrelo una vez y deje que las filas nuevas lleguen solas a Bitrix24.',
    items: [
      {
        icon: 'sheets',
        title: 'Directo desde Google Sheets',
        description:
          'Pegue el enlace de la hoja, elija la pestaña y listo. ImportSheet solo lee — su hoja de cálculo queda tal como está.',
      },
      {
        icon: 'entities',
        title: 'Todas las entidades del CRM',
        description:
          'Prospectos, negociaciones (con embudo), contactos, compañías, SPAs y tareas. Y comentarios en el Livefeed de registros que ya existen.',
      },
      {
        icon: 'mapping',
        title: 'Asignación columna por columna',
        description:
          'Vincule cada columna a un campo de Bitrix24, incluso campos personalizados, y cree el contacto y la compañía en la misma fila.',
      },
      {
        icon: 'dedup',
        title: 'Sin registros duplicados',
        description:
          'Marque una columna como identificador: si el registro ya existe, se actualiza en lugar de duplicarse.',
      },
      {
        icon: 'schedule',
        title: 'Programación',
        description:
          'Ejecute cada X horas, en los días de la semana que elija o solo cuando quiera, con un clic.',
      },
      {
        icon: 'incremental',
        title: 'Solo las filas nuevas',
        description:
          'Cada ronda continúa desde donde terminó la anterior. Si Bitrix24 pide una pausa, la importación espera y se reanuda sola.',
      },
      {
        icon: 'errors',
        title: 'Errores por fila',
        description:
          'Vea qué fila falló y por qué, corrija la hoja y reprocese solo lo que dio error.',
      },
      {
        icon: 'notify',
        title: 'Avisos de error',
        description:
          'Elija quién recibe una notificación en Bitrix24 cuando una importación termine con errores.',
      },
    ],
  },
  tutorialsSection: {
    title: 'Tutoriales',
    subtitle:
      'Simulaciones del recorrido real, dentro de Bitrix24. Elija un tema y haga clic en el resaltado naranja para avanzar.',
  },
  player: {
    tabsLabel: 'Tutoriales',
    variantsLabel: tutorial => `Tipos de ${tutorial.toLowerCase()}`,
    done: 'Listo',
    stepOf: (step, total) => `Paso ${step} de ${total}`,
    hint: 'Haga clic en el resaltado naranja de la pantalla:',
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
      app: 'ImportSheet',
      market: 'Market',
    },
    appMenu: {
      importacoes: 'Importaciones',
      configuracoes: 'Configuración',
      logs: 'Logs',
      ajuda: 'Ayuda',
    },
    poweredBy: 'Desarrollado por CRMThink',
    beta: 'Versión Beta',
    portalHost: 'suempresa.bitrix24.es',
  },
  shared: {
    importacoes: {
      title: 'Importaciones',
      subtitle: 'Área de trabajo de importaciones',
      newImport: 'Nueva importación',
      emptyBefore: 'Aún no hay importaciones. Haga clic en',
      emptyAfter: 'para empezar.',
    },
    lista: {
      manual: 'Manual',
      everyHours: hours => `Cada ${hours}h`,
      run: 'Ejecutar',
      running: 'En ejecución',
      scheduleActive: 'Programación activa',
      schedulePaused: 'Programación pausada',
      pauseSchedule: 'Pausar programación',
      edit: 'Editar',
      lastRun: when => `Última ejecución: ${when}`,
      neverRun: 'Nunca ejecutada',
      viewErrors: 'Ver errores',
    },
    configuracoes: {
      title: 'Configuración',
      subtitle: 'Integraciones y conexiones de la app',
      googleConnection: 'Conexión con Google',
      connected: 'Conectado',
      noAccount: 'Ninguna cuenta de Google conectada.',
      connectGoogle: 'Conectar con Google',
      disconnect: 'Desconectar',
      success: 'Cuenta de Google conectada con éxito.',
      closeNotice: 'Cerrar aviso',
      notifyTitle: 'Notificaciones de error',
      notifyDescription:
        'Usuarios que recibirán una notificación cuando una importación se complete con errores.',
      selectedCount: count => `${count} seleccionado(s)`,
      recipients: 'Destinatarios',
      clearAll: 'Limpiar todos',
      noneSelected: 'Ningún destinatario seleccionado todavía.',
      searchUser: 'Buscar usuario…',
      unsaved: 'Cambios sin guardar',
      allSaved: 'Todo guardado',
      save: 'Guardar',
    },
    configure: {
      title: 'Configurar importación',
      description: 'Defina el destino en Bitrix24 y la asignación de columnas',
      back: 'Volver',
      cancel: 'Cancelar',
      save: 'Guardar',
      identity: {
        name: 'Nombre de la importación',
        spreadsheet: 'Hoja de cálculo',
        tab: 'Seleccionar pestaña',
        startRow: 'Importar a partir de la fila',
        startRowHint: 'La fila 01 contiene los encabezados de la hoja.',
      },
      destination: { entity: 'Entidad', pipeline: 'Embudo' },
      entities: {
        LEAD: 'Lead',
        DEAL: 'Negocio',
        CONTACT: 'Contacto',
        COMPANY: 'Empresa',
        SPA: 'SPA',
        TASK: 'Tareas',
        FEED: 'Livefeed',
      },
      responsible: {
        column: 'Responsable (columna)',
        matchBy: 'Responsable identificado por',
      },
      match: { id: 'ID', email: 'Correo', phone: 'Teléfono' },
      options: {
        createContact: 'Crear contacto',
        createCompany: 'Crear empresa',
      },
      schedule: {
        title: 'Programación',
        frequency: 'Frecuencia',
        everyHours: 'Cada (horas)',
        weekdays: 'Días de la semana',
        manual: 'Ejecutar importación manualmente',
        frequencyOptions: { hours: 'Horas', days: 'Días de la semana' },
        weekdayLabels: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
      },
      mapping: {
        title: 'Asignación de columnas',
        description:
          'Asocie las columnas de su hoja con los campos de Bitrix24.',
        counter: (mapped, total) => `${mapped} de ${total} asignadas`,
        column: 'Columna',
        destination: 'Destino',
        field: 'Campos en Bitrix',
        identifier: 'Identificador',
        actions: 'Acciones',
        useAsIdentifier: 'Usar como identificador',
        removeColumn: 'Eliminar columna',
        destinations: { contact: 'Contacto', company: 'Empresa' },
        fieldTypes: {
          lista: 'lista',
          data: 'fecha',
          sn: 'S/N',
          moeda: '$',
          contato: 'contacto',
        },
      },
    },
    sample: {
      importTitle: 'Pedidos de la tienda',
      spreadsheetName: 'Tienda en línea 2026',
      spreadsheetId: '1AbC9xZ…',
      tab: 'Pedidos',
      pipeline: 'Ventas',
      columns: [
        {
          letter: 'A',
          label: 'Pedido',
          target: 'main',
          field: 'N.º de pedido',
        },
        { letter: 'B', label: 'Cliente', target: 'contact', field: 'Nombre' },
        {
          letter: 'C',
          label: 'Correo',
          target: 'contact',
          field: 'Correo',
          type: 'contato',
        },
        {
          letter: 'D',
          label: 'Valor',
          target: 'main',
          field: 'Oportunidad',
          type: 'moeda',
        },
        {
          letter: 'E',
          label: 'Etapa',
          target: 'main',
          field: 'Etapa',
          type: 'lista',
        },
        { letter: 'F', label: 'Vendedor', target: 'main', field: 'Vendedor' },
      ],
      googleEmail: 'tu@empresa.com',
      lastRunWhen: '13/10/2026 09:00',
      manualImportTitle: 'Registro de empresas',
      manualSpreadsheetName: 'Empresas socias',
    },
  },
  tutorials: {
    instalacao: INSTALACAO_ES,
    google: GOOGLE_ES,
    'nova-importacao': NOVA_IMPORTACAO_ES,
    mapeamento: MAPEAMENTO_ES,
    agendamento: AGENDAMENTO_ES,
    erros: ERROS_ES,
  },
  faq: {
    title: 'Preguntas frecuentes',
    items: [
      {
        question: 'No se encontró la hoja al validar. ¿Qué hago?',
        answer:
          'Revise que el enlace o ID pegado sea el de la hoja correcta — compárelo con la dirección del navegador con la hoja abierta. Luego, en Google Sheets, comparta la hoja (basta con permiso de lectura) con el correo de la cuenta de Google conectada en Configuración. Si la hoja es de otra cuenta, conecte esa cuenta en su lugar.',
        link: {
          href: '#tutorial-nova-importacao',
          label: 'Ver el tutorial de nueva importación',
        },
      },
      {
        question: 'Se cayó la conexión con Google. ¿Cómo la reconecto?',
        answer:
          'En Configuración, haga clic en Conectar con Google y elija, en la ventana de Google, la cuenta que tiene acceso a las hojas. Esto ocurre cuando el acceso se revoca en la propia cuenta de Google o expira. Después de reconectar, vuelva a ejecutar la importación.',
        link: {
          href: '#tutorial-google',
          label: 'Ver el tutorial de conexión con Google',
        },
      },
      {
        question: '¿Puedo renombrar o borrar la pestaña de la hoja?',
        answer:
          'Renombrar, sí: la importación sigue a la pestaña aunque cambie de nombre. Borrar, no — sin la pestaña la importación deja de ejecutarse. Si eso ocurre, haga clic en Editar en la importación, elija la pestaña correcta en Seleccionar pestaña y guarde.',
      },
      {
        question: '¿Por qué no aparece ninguna columna para asignar?',
        answer:
          'Los títulos de las columnas deben estar en la fila 1 de la pestaña elegida. Si esa fila está vacía, no hay columnas para asignar. Revise que la pestaña sea la correcta y ponga los títulos en la primera fila.',
      },
      {
        question: 'La fila se importó, pero un campo quedó vacío. ¿Por qué?',
        answer:
          'Los campos de lista de Bitrix24 (como etapa, origen o listas personalizadas) solo aceptan una opción que ya existe. Si el texto de la hoja no es exactamente igual a una opción — una tilde, una mayúscula o un espacio de más —, ese campo se ignora sin aviso y el resto de la fila se importa normalmente. Iguale el texto a la opción o cree la opción en Bitrix24. Para reenviar esas filas, edite la importación y retroceda "Importar a partir de la fila" hasta ellas; con el identificador marcado, los registros se actualizan en lugar de duplicarse.',
      },
      {
        question: '¿Cómo evita ImportSheet los registros duplicados?',
        answer:
          'Con la columna marcada como identificador. Si el valor coincide con un registro, se actualiza; si no coincide con ninguno, se crea; si coincide con más de uno, la fila no se importa y aparece en los errores. En ese caso, combine o elimine los duplicados en Bitrix24 (o elija una columna realmente única) y reprocese la fila.',
        link: {
          href: '#tutorial-mapeamento',
          label: 'Ver el tutorial de asignación',
        },
      },
      {
        question: 'El responsable del registro no es el que estaba en la hoja.',
        answer:
          'La columna de responsable debe traer el ID, el correo o el teléfono (lo que eligió en "Responsable identificado por") de un usuario activo de Bitrix24. Si no encuentra al usuario, la fila se importa igual, con el responsable predeterminado. Corrija el valor en la hoja y ajuste el responsable de los registros que ya entraron.',
      },
      {
        question: '¿La importación lee toda la hoja cada vez?',
        answer:
          'No. Cada ronda continúa desde donde terminó la anterior y lee solo las filas nuevas, agregadas al final. Las filas ya importadas que usted modifique después no se vuelven a leer. Si Bitrix24 está sobrecargado, la ronda se pausa y se reanuda sola desde el mismo punto.',
        link: {
          href: '#tutorial-agendamento',
          label: 'Ver el tutorial de programación',
        },
      },
      {
        question: 'Mi importación programada dejó de ejecutarse.',
        answer:
          'Puede estar pausada: por alguien, en el interruptor de la lista, o automáticamente después de un error que interrumpió la ronda. Abra Ver errores, resuelva la causa y vuelva a activar el interruptor de la programación. Quien esté en Notificaciones de error recibe un aviso cuando esto ocurre.',
        link: {
          href: '#tutorial-erros',
          label: 'Ver el tutorial de errores y reprocesamiento',
        },
      },
    ],
  },
  finalCta: {
    title: 'Lleve sus hojas de cálculo a Bitrix24',
    subtitle:
      'Instale ImportSheet desde el Market o hable con nuestro equipo para encontrar el mejor formato para su operación.',
    fallback:
      'Busque ImportSheet en el Bitrix24 Market de su portal para instalarlo.',
  },
  ctaButtons: {
    install: 'Instalar en Bitrix24',
    whatsapp: 'Hablar por WhatsApp',
  },
  footer: year => `ImportSheet · Google Sheets para Bitrix24 · © ${year}`,
}
