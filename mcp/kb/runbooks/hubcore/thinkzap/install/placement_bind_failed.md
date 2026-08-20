---
category: integration
audience: suporte
summary: A instalação não conseguiu registrar uma tela do app no Bitrix24.
---
# thinkzap.install.placement_bind_failed

## O que significa
Durante a instalação, o app thinkzap tentou registrar uma de suas telas no Bitrix24, mas esse registro não foi concluído. Na prática, alguma tela do app pode não aparecer no lugar esperado dentro do Bitrix24. Costuma ser uma falha pontual da instalação e, em geral, se resolve reinstalando o app. Pode ser retentado.

## Causa provável
- **Falha pontual na instalação**: o registro da tela não foi concluído durante o processo.
- **Permissões insuficientes**: o app não tinha os escopos necessários no Bitrix24 no momento da instalação.
- **Instabilidade momentânea do Bitrix24**: uma oscilação durante o registro.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.install.placement_bind_failed`.
3. Veja no log qual tela (placement) não pôde ser registrada.

## Como resolver
1. Oriente o parceiro a reinstalar o app no portal Bitrix24.
2. Confirme que o app tem as permissões necessárias durante a instalação.
3. Após reinstalar, verifique se as telas do app aparecem e confirme na tela de Logs que o erro não se repete.

## Quando escalar
Se o registro continuar falhando mesmo após reinstalar e com as permissões corretas, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.install.placement_bind_failed`, domínio do parceiro, o horário do evento e a tela (placement) envolvida.
