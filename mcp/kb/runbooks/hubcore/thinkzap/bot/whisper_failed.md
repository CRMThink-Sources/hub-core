---
category: integration
audience: suporte
summary: O resumo do atendimento automático não foi registrado no chat antes da transferência.
---
# thinkzap.bot.whisper_failed

## O que significa
Quando o bot de atendimento transfere a conversa para um atendente, ele antes escreve no chat do canal aberto um resumo do que já perguntou e do que o cliente respondeu. Esse resumo é interno: aparece para o atendente dentro do Bitrix24 e **não** é enviado ao cliente.

Este aviso diz que o resumo não foi registrado.

**A transferência aconteceu normalmente.** O cliente foi para a fila ou para o atendente escolhido, e o atendimento segue. O que faltou foi o resumo que daria contexto a quem assumiu.

## Causa provável
- **Instabilidade momentânea** do Bitrix24 no instante do registro. É a causa mais comum, e some sozinha.
- **A conversa foi encerrada** no Bitrix24 entre a última fala do bot e a transferência.
- **O bot deixou de participar da conversa** antes de escrever o resumo — nesse caso costuma aparecer junto o aviso `thinkzap.bot.say_session_gone`.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo identificador do evento (o traceKey da tela de Logs).
2. Confirme o código de erro `thinkzap.bot.whisper_failed` e anote o `chatId`.
3. Abra a conversa no Bitrix24: as falas do bot e o registro da transferência devem estar lá, e faltará o resumo entre as duas.

## Como resolver
1. Nenhuma ação corretiva: o resumo é contexto, não parte do atendimento. Não existe reenvio.
2. O atendente tem a conversa inteira com o cliente logo acima, no mesmo chat — o que o resumo traria está lá, só que não condensado.
3. Se o aviso aparecer de forma repetida, e não isolada, acione o desenvolvimento.

## Quando escalar
Escale se o aviso se repete em várias conversas, ou se vier acompanhado de relatos de transferências que não chegaram ao atendente (nesse caso o problema é de transferência, não de resumo). Acione a equipe de desenvolvimento e anexe: identificador do evento (traceKey), código de erro `thinkzap.bot.whisper_failed`, `chatId`, domínio/portal do parceiro e horário do evento.
