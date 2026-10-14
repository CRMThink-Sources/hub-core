import type { MapeamentoCopy } from '../../pt/tutorials/mapeamento'

export const MAPEAMENTO_ES: MapeamentoCopy = {
  tutorial: {
    slug: 'mapeamento',
    label: 'Configurar y asignar',
    summary:
      'Destino en Bitrix24, responsable, asignación de columnas y el identificador que evita duplicados.',
    steps: [
      {
        screen: 'identity',
        title: 'Póngale un nombre y revise la pestaña',
        description:
          'Nombre la importación y revise la pestaña. La fila 1 de la pestaña debe tener los títulos de las columnas; los datos empiezan en "Importar a partir de la fila" (2, por defecto).',
        action: 'Importar a partir de la fila',
      },
      {
        screen: 'entity',
        title: 'Elija la entidad de destino',
        description:
          'Lead, Negocio, Contacto, Empresa, SPA, Tareas o Livefeed. Negocio pide el embudo; SPA pide el tipo y luego el embudo. Livefeed publica un comentario en la línea de tiempo de un registro que ya existe.',
        action: 'Negocio',
      },
      {
        screen: 'responsible',
        title: 'Defina el responsable',
        description:
          'Indique la columna con el responsable de cada fila y cómo identificarlo: ID, correo o teléfono de un usuario activo de Bitrix24.',
        action: 'Responsable identificado por',
      },
      {
        screen: 'options',
        title: 'Cree el contacto y la compañía a la vez',
        description:
          'Active Crear contacto y/o Crear empresa para que la misma fila también genere el contacto y la compañía vinculados al registro.',
        action: 'Crear contacto',
      },
      {
        screen: 'mapping',
        title: 'Vincule cada columna a un campo',
        description:
          'Para cada columna, elija el destino (el registro principal, el contacto o la compañía) y el campo en Bitrix24. Las etiquetas muestran el tipo de campo: lista, fecha, S/N, $. Toda columna necesita un campo — las que no le interesen, elimínelas con la papelera.',
        action: 'Contacto',
      },
      {
        screen: 'identifier',
        title: 'Marque el identificador',
        description:
          'Marque la columna que identifica el registro (un código, correo o documento). Si encuentra 1 registro con ese valor, se actualiza; si no encuentra ninguno, se crea; si encuentra más de uno, la fila queda fuera y aparece en los errores.',
        action: 'Usar como identificador',
      },
      {
        screen: 'save',
        title: 'Guarde la importación',
        description:
          'Con todo asignado, haga clic en Guardar. La importación aparece en la lista.',
        action: 'Guardar',
      },
    ],
    done: {
      title: 'Importación configurada',
      description:
        'Destino, responsable y asignación guardados. Solo falta decidir cuándo se ejecuta.',
    },
  },
  screens: {},
}
