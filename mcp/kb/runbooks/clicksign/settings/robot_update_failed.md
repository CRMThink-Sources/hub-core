---
category: integration
audience: suporte
summary: As configurações salvaram, mas o CRMThink não conseguiu atualizar no Bitrix24 as opções da automação de assinatura.
---
# clicksign.settings.robot_update_failed

## O que significa
Dentro do Bitrix24 existe uma automação que dispara o envio de documentos pra assinatura — é uma ação automática que o parceiro coloca no fluxo do negócio (o Bitrix24 chama isso de "robô"). Essa automação tem algumas opções escolhidas pelo parceiro (por exemplo, quais dados usar no envio), e essas opções precisam refletir o que está salvo nas configurações da integração. Quando o parceiro salva as configurações, o CRMThink tenta empurrar essas opções atualizadas pra dentro do Bitrix24. Este erro quer dizer que o salvamento funcionou, mas essa atualização da automação no Bitrix24 falhou. Na prática, a automação de assinatura pode continuar mostrando opções antigas, diferentes do que o parceiro acabou de configurar.

## Causa provável
- **Autorização do aplicativo no Bitrix24 vencida ou sem permissão** (mais comum): pra mexer na automação, o CRMThink precisa de uma autorização ativa dentro do Bitrix24, com permissão pra alterar automações. Se essa autorização venceu ou o aplicativo não tem essa permissão, o Bitrix24 bloqueia a atualização.
- **Bitrix24 fora do ar no momento**: se o portal estava instável ou indisponível na hora em que o parceiro salvou, a atualização não chegou a ser concluída.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: clicksign.settings.robot_update_failed`.
3. Oriente o parceiro a abrir, no Bitrix24, a automação de assinatura e verificar se as opções estão realmente desatualizadas em relação ao que ele configurou. Isso confirma que a atualização não chegou.

## Como resolver
1. Oriente o parceiro a reautorizar o aplicativo Clicksign no Bitrix24 (reconectar ou reinstalar o aplicativo). Isso renova a autorização vencida, que é o que costuma travar a alteração da automação.
2. Peça ao parceiro pra confirmar que o aplicativo tem permissão pra alterar automações no portal. Sem essa permissão, o Bitrix24 nunca vai deixar o CRMThink atualizar a automação.
3. Oriente o parceiro a salvar as configurações de novo. Salvar faz o CRMThink repetir o envio das opções pro Bitrix24, agora com a autorização e as permissões em dia.

## Quando escalar
Se a autorização foi renovada, as permissões estão confirmadas e o erro persiste após salvar de novo, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: clicksign.settings.robot_update_failed`, domínio do parceiro e o horário do evento.
