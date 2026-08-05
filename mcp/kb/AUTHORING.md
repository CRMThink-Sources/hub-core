# Padrão de conteúdo do KB — anti-vazamento

Todo conteúdo deste KB é servido **verbatim** a um assistente externo (connector
claude.ai) que responde ao suporte e, por tabela, ao cliente. Conteúdo interno que
entra aqui **vaza**. Guardrail de instrução no modelo é defesa secundária — a
primária é: **o dado não pode conter o que não pode vazar.**

Este padrão vale para `kb/apps/*.md` e `kb/runbooks/**/*.md`, incl. produtos novos
(sonax, gptmaker, rdstation).

## O que é servido (e por quem)

| Conteúdo | Tool | Servido? |
| --- | --- | --- |
| `kb/apps/<app>.md` | `describe_app` | **Sim, body inteiro** — leitura live (não cacheia). |
| runbook `audience: suporte` **sem** `stub: true` | `get_runbook` | **Sim, body inteiro.** |
| runbook `stub: true` (dev / observabilidade) | `get_runbook` | **Só o `summary`** + escalonamento. O body NUNCA é servido. |
| `summary:` de qualquer runbook | `list_error_catalog` / `get_runbook` | **Sim** (uma linha). |

Consequência: o `summary` de **todo** runbook (mesmo dev/stub) é público. Ele também
tem que ser limpo.

## NUNCA no conteúdo servido (= vazamento)

- Nomes de método/API internos: `biconnector.connector.*`, `telephony.externalcall.register`, qualquer `namespace.metodo`.
- Identificadores de código: caminhos (`src/...`), nomes de função/classe/módulo/variável.
- Infra/banco: SQL, nomes de tabela/coluna, `prisma`, filas, Redis, nomes de container.
- Narrativa de arquitetura: "o CRMThink persiste no banco", "o worker consome a fila", quem-chama-quem entre serviços — **COMO** o sistema funciona por dentro.
- Enumeração de errorCodes internos/dev que não sejam o code do próprio runbook.
- Segredos, tokens, credenciais, URLs/hosts internos.

## PODE (e deve) no conteúdo servido

- O errorCode do próprio runbook.
- Linguagem de suporte: "confira a credencial", "reconecte a conta", "peça o traceKey".
- Nomes de produtos externos que o cliente conhece: Bitrix24, Google Sheets, Clicksign, Asaas, Bling, Conta Azul, Omie, Sonax.
- Referências de UI do cliente: "tela de Configurações", "modal de erros".

## Regras por tipo

### `kb/apps/<app>.md` (describe_app)
- Estrutura: `O que é (nível suporte)` → nota "apoio interno, não relatar" → `Modos de falha comuns (para triar)` → `Dicas de triagem`.
- **Proibido** seção de "fluxos principais"/processo interno. Descreva **o que** o app faz pro cliente em 1–3 linhas, nunca **como** faz por dentro.
- Modos de falha citam errorCodes de **suporte**; erros técnicos → "escale com traceKey", sem enumerar.

### runbook `audience: suporte` (body servido)
- Body inteiro em linguagem de suporte. Segue as regras "NUNCA/PODE" acima.
- Estrutura típica: `O que significa` → `Causa provável` → `Como verificar` → `Como resolver` → `Quando escalar`.

### runbook `audience: dev` / `observabilidade` (deve ter `stub: true`)
- Body é pro dev — **pode** ter detalhe interno (só devs leem o arquivo direto; o body não é servido).
- **Mas o `summary` é servido** → o summary tem que ser limpo (sem método/arquitetura). Descreva a causa em linguagem de suporte.

## Checklist antes de commitar KB

- [ ] Rodei o grep de vazamento (abaixo) e deu limpo no conteúdo servido.
- [ ] App doc não tem seção de fluxo/processo interno.
- [ ] `summary` de todo runbook novo está em linguagem de suporte.
- [ ] Runbook dev/interno está marcado `stub: true` + `audience: dev|observabilidade`.
- [ ] Todo errorCode emitido no código tem runbook (teste de contrato do app).

## Grep de vazamento (rodar em `kb/`)

```bash
# summaries de qualquer runbook + apps + bodies de runbooks suporte não podem casar:
grep -rnoE "telephony\.[a-zA-Z.]+|[a-z]+\.[a-z]+\.\*|SELECT |prisma\.|axios\.|\.controller|src/[a-z]|HMAC" kb/apps/ kb/runbooks/
# summaries (sempre servidos) — checar leaks:
grep -rh "^summary:" kb/runbooks/ | grep -iE "biconnector|telephony|SELECT|prisma|src/|\.\*"
```
