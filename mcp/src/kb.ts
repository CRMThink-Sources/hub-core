import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname, relative, sep, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

// Raiz do KB = kb/ dentro do próprio pacote (versionado, viaja junto no deploy).
// Sobrescrevível via KB_DIR se precisar apontar pra outro lugar.
const KB_DIR = process.env.KB_DIR
  ? resolve(process.env.KB_DIR)
  : resolve(here, '..', 'kb')

const RUNBOOKS_DIR = join(KB_DIR, 'runbooks')
const APPS_DIR = join(KB_DIR, 'apps')

export type Audience = 'suporte' | 'dev' | 'observabilidade'

export type Runbook = {
  errorCode: string // derivado do caminho: clicksign/webhook/x.md → clicksign.webhook.x
  app: string // 1º segmento do caminho
  area: string // 2º segmento (webhook, envelope, ...)
  category: string // classe do erro (auth, config, integration) — do frontmatter
  audience: Audience // quem resolve: suporte | dev | observabilidade
  stub: boolean // true = só catálogo, sem passo-a-passo (get_runbook manda escalar)
  summary: string
  body: string
}

// Frontmatter mínimo `key: value` entre linhas `---`. Sem dep de YAML: as chaves
// do runbook são strings simples de uma linha.
function parseFrontmatter(raw: string): {
  meta: Record<string, string>
  body: string
} {
  if (!raw.startsWith('---')) return { meta: {}, body: raw }
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return { meta: {}, body: raw }
  const block = raw.slice(3, end)
  const body = raw.slice(raw.indexOf('\n', end + 1) + 1).trimStart()
  const meta: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const sep = line.indexOf(':')
    if (sep === -1) continue
    const key = line.slice(0, sep).trim()
    // Tira aspas cercando o valor (artefato de quem escreveu `summary: "..."`).
    if (key)
      meta[key] = line
        .slice(sep + 1)
        .trim()
        .replace(/^"(.*)"$/, '$1')
  }
  return { meta, body }
}

// Anda a árvore de runbooks recursivamente e devolve os .md.
function walkMarkdown(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkMarkdown(full))
    else if (entry.name.endsWith('.md')) out.push(full)
  }
  return out
}

function loadRunbooks(): Map<string, Runbook> {
  const map = new Map<string, Runbook>()
  if (!existsSync(RUNBOOKS_DIR)) return map
  for (const file of walkMarkdown(RUNBOOKS_DIR)) {
    const { meta, body } = parseFrontmatter(readFileSync(file, 'utf8'))
    // Caminho: <família>/<app>/<area>/<causa>.md. A família (hubcore/hubthink) é só
    // organização de diretório — NÃO entra no errorCode (contrato = <app>.<area>.<causa>).
    const rel = relative(RUNBOOKS_DIR, file).replace(/\.md$/, '')
    const segments = rel.split(sep)
    if (segments.length < 3) continue // fora do padrão família/app/area/causa
    const parts = segments.slice(1) // descarta a família
    const errorCode = parts.join('.')
    const audience: Audience =
      meta.audience === 'suporte' ||
      meta.audience === 'dev' ||
      meta.audience === 'observabilidade'
        ? meta.audience
        : 'dev'
    map.set(errorCode, {
      errorCode,
      app: parts[0] ?? 'unknown',
      area: parts[1] ?? 'unknown',
      category: meta.category ?? 'unknown',
      audience,
      stub: meta.stub === 'true',
      summary: meta.summary ?? '',
      body,
    })
  }
  return map
}

// Carrega uma vez no boot; deploy do MCP recarrega. Simples e suficiente.
const runbooks = loadRunbooks()

export function getRunbook(errorCode: string): Runbook | undefined {
  return runbooks.get(errorCode)
}

export function listCatalog(app?: string): Array<Omit<Runbook, 'body'>> {
  return [...runbooks.values()]
    .filter(r => !app || r.app === app)
    .map(({ body: _body, ...rest }) => rest)
    .sort((a, b) => a.errorCode.localeCompare(b.errorCode))
}

// Guard contra path traversal: `app` casa por basename num índice pré-varrido, então
// só aceita nome simples (sem `/`, `..`, `\`, nulo). Fora do padrão → inexistente.
const SAFE_APP_NAME = /^[a-z0-9_-]+$/

// Docs de app vivem em subpastas por família (apps/hubcore/, apps/thinkhub/). Acha
// o <app>.md em qualquer nível — a subpasta é só organização, o nome do app é único.
function findAppDoc(app: string): string | undefined {
  if (!existsSync(APPS_DIR)) return undefined
  const target = `${app}.md`
  return walkMarkdown(APPS_DIR).find(f => basename(f) === target)
}

export function describeApp(app: string): string | undefined {
  if (!SAFE_APP_NAME.test(app)) return undefined
  const file = findAppDoc(app)
  if (!file) return undefined
  return readFileSync(file, 'utf8')
}

export function knownApps(): string[] {
  if (!existsSync(APPS_DIR)) return []
  return walkMarkdown(APPS_DIR)
    .map(f => basename(f, '.md'))
    .sort()
}
