import type { NegocioCopy } from '../../pt/tutorials/negocio'

export const NEGOCIO_ES: NegocioCopy = {
  tutorial: {
    slug: 'negocio',
    label: 'Preparar la negociación',
    summary:
      'Crea los campos de la negociación que guardan el documento y el retorno de la firma, y elige las verificaciones del firmante.',
    steps: [
      {
        screen: 'crm-fields',
        title: 'Crea los campos en la negociación',
        description:
          'Antes que nada, en la configuración del CRM de Bitrix24, crea estos campos personalizados en Negociaciones: dos de archivo (el documento a firmar y el Archivo Firmado), dos de fecha (Fecha Límite y Fecha de Firma) y tres de texto (ID del Documento, Estado de Firma y Proceso Finalizado). La app no crea estos campos.',
        action: 'Agregar campo',
      },
      {
        screen: 'extra-tab',
        title: 'Abre la pestaña Extra',
        description:
          'De vuelta en la app, en Configuración, haz clic en la pestaña Extra.',
        action: 'Extra',
      },
      {
        screen: 'additional',
        title: 'Elige las verificaciones',
        description:
          'En Configuración Adicional, marca lo que Clicksign debe pedirle a quien firma: selfie, biometría facial, firma manuscrita, foto del documento oficial o rúbrica (la rúbrica requiere la función de sobre activa en tu cuenta). La biometría facial tiene un costo adicional de R$ 1,50 por biometría facial realizada con éxito (cobrado por Clicksign).',
        action: 'Solicitar la foto (frente y reverso) del documento oficial',
      },
      {
        screen: 'contact-fields',
        title: 'Indica los campos del contacto',
        description:
          'En Campos de Contacto, elige el campo del contacto que guarda el CPF y el que indica si es extranjero. Es obligatorio cuando quien firma es el contacto de la negociación.',
        action: 'CPF',
      },
      {
        screen: 'save-extra',
        title: 'Guarda',
        description: 'Haz clic en Guardar para guardar la pestaña Extra.',
        action: 'Guardar',
      },
    ],
    done: {
      title: 'Negociación lista',
      description:
        'Los campos existen y las verificaciones están elegidas. Ahora arma el grupo de firma, que vincula cada campo con su función.',
    },
  },
  screens: {
    crmFields: {
      title: 'Campos personalizados · Negociación',
      name: 'Nombre',
      type: 'Tipo',
      add: 'Agregar campo',
    },
  },
}
