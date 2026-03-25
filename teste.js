const mapExportToDriver = {
  banco_mysql: 'mysql',
  banco_postgres: 'postgres',
}

const comment = {
  ID: '399438',
  ENTITY_ID: '25686',
  ENTITY_TYPE: 'deal',
  CREATED: '2026-03-24T04:38:50+03:00',
  COMMENT: 'Atualização do comentario',
  AUTHOR_ID: '508',
}
const exports = [
  {
    id: 2212,
    title: 'teste comentários',
    entities:
      '[{"type":"crm_timeline","value":{"filters":[{"field":"DATE_MODIFY","field_type":"datetime","type":">","value":"2025-05-01T03:00:00.000Z","recurrent":true,"advanced":false}],"listId":null,"spaId":null,"crmType":"DEAL","fields":[{"id":"ID","type":"string","label":"ID","checked":true,"options":null,"size":"1000"},{"id":"COMMENT","type":"string","label":"COMMENT","checked":true,"options":null,"size":"1000"},{"id":"ENTITY_ID","type":"integer","label":"ENTITY_ID","checked":true,"options":null,"size":"1000"},{"id":"ENTITY_TYPE","type":"string","label":"ENTITY_TYPE","checked":true,"options":null,"size":"1000"}],"options":{"ref":"teste_comentarios","prevent_duplication":false,"varchar_as_text":false}}}]',
    options:
      '{"ref":"devjoao","username":"joao","password":"6uzk7rkb3y1k2mqx7ljw","url":"64.225.116.134","port":"3306"}',
    schedule_type: 'hour',
    schedule: '1',
    export_to: 'banco_mysql',
    format: null,
    last_run_at: null,
    next_run_at: null,
    success_run_at: null,
    failed_at: '2026-03-24T00:16:24.000Z',
    started_at: null,
    active: 0,
    obj: '{"title":"teste coment\\u00e1rios","schedule":null,"schedule_type":"not","format":null,"export_to":"banco_mysql","options":{"ref":"devjoao","username":"joao","password":"6uzk7rkb3y1k2mqx7ljw","url":"64.225.116.134","port":"3306"},"entities":[{"type":"crm_timeline","value":{"filters":[{"field":"DATE_MODIFY","field_type":"datetime","type":">","value":"2025-05-01T03:00:00.000Z","recurrent":true,"advanced":false}],"listId":null,"spaId":null,"crmType":"DEAL","fields":[{"id":"ID","type":"string","label":"ID","checked":true,"options":null},{"id":"ENTITY_ID","type":"integer","label":"ENTITY_ID","checked":true,"options":null},{"id":"ENTITY_TYPE","type":"string","label":"ENTITY_TYPE","checked":true,"options":null},{"id":"AUTHOR_ID","type":"string","label":"AUTHOR_ID","checked":true,"options":null},{"id":"CREATED","type":"datetime","label":"CREATED","checked":true,"options":null},{"id":"COMMENT","type":"string","label":"COMMENT","checked":true,"options":null}],"options":{"ref":"teste_comentario","prevent_duplication":false,"varchar_as_text":false}}}]}',
    bitrix_domain_member_id: 223,
    created_at: '2025-05-12T18:28:47.000Z',
    updated_at: '2026-03-24T00:16:24.000Z',
    deleted_at: null,
    last_ref: null,
    temporary_date: '2026-03-24T00:16:20.000Z',
    tries: 0,
    status_extract: 0,
    status_export: 0,
    last_partial_ref: null,
    log_level: 0,
    temp_partial_ref: null,
    total: 0,
    current_total: 0,
    progress: 0,
    steps: 0,
    current_step: 0,
    check_deleted: 0,
    debug: null,
    bitrix_domain_id: 224,
    export_status: 0,
    reserved_at: null,
    execution_time: null,
    bitrix_operation: null,
    page_limit: null,
    next_schedule_time: null,
  },
]
const data = exports.map(ex => {
  const entity = JSON.parse(ex.entities)[0]
  const opts = JSON.parse(ex.options)
  const tableName = entity.value.options.ref

  const fields = Object.fromEntries(
    entity.value.fields.map(f => [f.label, comment[f.id] || null]),
  )

  const columns = Object.keys(fields)
  const values = Object.values(fields)
  const placeholders = columns.map(() => '?').join(', ')

  const driver = mapExportToDriver[ex.export_to]
  const connection = {
    host: opts.url,
    port: opts.port,
    username: opts.username,
    password: opts.password,
    database: opts.ref,
  }

  const buildQuery = (query, bindings) => ({
    driver,
    connection,
    query,
    bindings,
  })

  return {
    selectQuery: buildQuery(`SELECT * FROM ${tableName} WHERE id = ?`, [
      comment.ID,
    ]),
    insertQuery: buildQuery(
      `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
      values,
    ),
    updateQuery: buildQuery(
      `UPDATE ${tableName} SET ${columns.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...values, comment.ID],
    ),
  }
})

console.log(data)
