import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CLICKSIGN_ERRORS } from './catalog'

// Guardrail do casamento log ↔ runbook (ver tasks/geral/suporte.md).
const RUNBOOKS_ROOT = path.resolve(
  __dirname,
  '../../../../../mcp/kb/runbooks/hubcore',
)
const CLICKSIGN_DIR = path.join(RUNBOOKS_ROOT, 'clicksign')

const EMITTED = new Set<string>(Object.keys(CLICKSIGN_ERRORS))

// Runbooks audience:suporte cujo code ainda não sai no log. Deve ficar vazio.
const PENDING_EMISSION = new Set<string>([])

function codeFromPath(file: string): string {
  return path
    .relative(RUNBOOKS_ROOT, file)
    .replace(/\.md$/, '')
    .split(path.sep)
    .join('.')
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name)
    return e.isDirectory() ? walk(full) : e.name.endsWith('.md') ? [full] : []
  })
}

function audience(file: string): string {
  return /^audience:\s*(\S+)/m.exec(readFileSync(file, 'utf8'))?.[1] ?? 'dev'
}

describe('casamento errorCode ↔ runbook (clicksign)', () => {
  it('todo code emitido tem runbook', () => {
    for (const code of EMITTED) {
      expect(
        existsSync(path.join(RUNBOOKS_ROOT, ...code.split('.')) + '.md'),
        code,
      ).toBe(true)
    }
  })

  const suporte = walk(CLICKSIGN_DIR)
    .filter(f => audience(f) === 'suporte')
    .map(codeFromPath)

  it('todo runbook audience:suporte sai no log (ou está em PENDING_EMISSION)', () => {
    const missing = suporte.filter(
      c => !EMITTED.has(c) && !PENDING_EMISSION.has(c),
    )
    expect(
      missing,
      `runbooks de suporte sem emissão no log: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('PENDING_EMISSION não tem entrada obsoleta', () => {
    const stale = [...PENDING_EMISSION].filter(
      c => EMITTED.has(c) || !suporte.includes(c),
    )
    expect(stale, `remova de PENDING_EMISSION: ${stale.join(', ')}`).toEqual([])
  })
})
