import type { GrupoCopy } from '../../pt/tutorials/grupo'

export const GRUPO_ES: GrupoCopy = {
  tutorial: {
    slug: 'grupo',
    label: 'Grupo de firma',
    summary:
      'El grupo indica en qué campo está el documento, dónde guardar el retorno y quién firma.',
    steps: [
      {
        screen: 'new-group',
        title: 'Crea un grupo',
        description:
          'En la app, en Grupos de firma, haz clic en Nuevo Grupo. Puedes tener un grupo para cada tipo de documento.',
        action: 'Nuevo Grupo',
      },
      {
        screen: 'group-id',
        title: 'Ponle un nombre al grupo',
        description:
          'El identificador es el nombre que eliges después en el robot de Bitrix24.',
        action: 'Identificador del grupo',
      },
      {
        screen: 'deal-fields',
        title: 'Vincula los campos del Negocio',
        description:
          'En Campos del Negocio, elige los campos creados en el tutorial anterior. En Archivo para Firma solo cuenta el primer archivo del campo, en PDF, DOC, DOCX, PNG o JPG.',
        action: 'Archivo para Firma',
      },
      {
        screen: 'default-contact',
        title: 'Define quién firma',
        description:
          'En Configuración de Contactos, el grupo nuevo ya viene con un contacto; Agregar Contacto suma otros. Con Usar el contacto predeterminado del negocio activado, todos los contactos de la negociación firman, con el CPF del campo elegido en la pestaña Extra. Desactivado, indicas los campos de la negociación con el nombre, el email y el CPF de quien firma. En Grupo (1 a 10) va el orden de firma.',
        action: 'Usar el contacto predeterminado del negocio',
      },
      {
        screen: 'add-participant',
        title: 'Incluye a alguien de tu equipo',
        description:
          'En Participantes, haz clic en Agregar para incluir a un usuario de Bitrix24 que también firma — un gerente o un testigo, por ejemplo.',
        action: 'Agregar',
      },
      {
        screen: 'participant',
        title: 'Elige el usuario y la función',
        description:
          'Elige un Usuario fijo o un Campo de Usuario de la negociación (como el responsable), la Función con la que firma y el Grupo.',
        action: 'Función',
      },
      {
        screen: 'save',
        title: 'Guarda',
        description:
          'Haz clic en Guardar. ¿Creaste, renombraste o eliminaste un grupo o una empresa? Guarda y vuelve a abrir el robot para que sus listas se actualicen.',
        action: 'Guardar',
      },
    ],
    done: {
      title: 'Grupo listo',
      description:
        'Solo falta el robot: es el que envía el documento cuando la negociación llega a la etapa correcta.',
    },
  },
  screens: {},
}
