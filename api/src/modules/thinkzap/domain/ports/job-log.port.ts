/**
 * Escreve uma linha no log **do próprio job**, não no stdout do processo.
 *
 * São dois destinos diferentes e complementares:
 *
 * - `workerLogger`/`apiLogger` → stdout → Promtail → Loki. Bom para agregar, alertar e
 *   correlacionar entre mensagens. Ruim para responder "o que houve com **esta**", que
 *   exige montar uma query.
 * - Este port → `job.log()` do BullMQ → **aba Logs do job no Bull Board**. É onde quem
 *   está olhando um job específico espera encontrar a história dele, já filtrada, sem
 *   query nenhuma.
 *
 * A aba existe no Bull Board ao lado de Data, Options, Progress e Error. Vazia, ela
 * sugere que não houve nada a registrar — quando na verdade tudo foi para outro lugar.
 *
 * **Cada chamada é um round-trip ao Redis.** Registrar decisão e desfecho, não passo a
 * passo: um log por etapa relevante, não por linha de código.
 *
 * Nunca lança — log que derruba o trabalho que estava observando é pior que log
 * ausente. Ver as implementações.
 */
export type AppendJobLog = (line: string) => Promise<void>

/** Para quem não tem job em mãos: testes e chamadas fora da fila. */
export const noopJobLog: AppendJobLog = () => Promise.resolve()
