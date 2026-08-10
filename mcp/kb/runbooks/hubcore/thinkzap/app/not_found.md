---
category: config
audience: suporte
summary: O app thinkzap não está instalado neste portal, ou foi removido, então não há instalação ativa para operar.
---
# thinkzap.app.not_found

## O que significa
A requisição chegou identificando um portal, mas o app thinkzap não está instalado (ou foi removido) nesse portal. Sem uma instalação ativa, o app não tem onde operar e recusa a ação. Diferente de uma sessão perdida, aqui o ponto é que a instalação em si não existe ou não está ativa.

## Causa provável
- **App não instalado**: o portal nunca teve o app instalado.
- **App removido/desinstalado**: o app foi retirado do portal em algum momento.
- **Instalação inativa**: a instalação existe mas não está ativa (por exemplo, após problema de contratação).

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.app.not_found`.
3. Confirme com o parceiro qual portal está sendo usado e se o app aparece instalado e ativo nele.

## Como resolver
1. Oriente o parceiro a confirmar, no próprio portal, que o app thinkzap está instalado e ativo.
2. Se não estiver, peça para instalar (ou reinstalar) o app no portal.
3. Depois de instalado e ativo, peça para reabrir o app e repetir a ação.

## Quando escalar
Se o parceiro confirmar que o app está instalado e ativo no portal e o erro persistir, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.app.not_found`, domínio do parceiro e o horário do evento.
