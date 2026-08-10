---
category: config
audience: suporte
summary: O app Sonax não está instalado no portal, então a operação de telefonia não pôde ser executada.
---
# sonax.app.not_installed

## O que significa
O Sonax é a integração de telefonia entre o SonaVoip e o Bitrix24. Para funcionar, o app Sonax precisa estar instalado e ativo no portal Bitrix24 do parceiro.

Esse erro quer dizer que a operação de telefonia foi solicitada, mas o CRMThink não encontrou o app Sonax instalado nesse portal. Sem o app instalado, não há como registrar chamadas, discar ou tratar campanhas.

## Causa provável
- **App nunca instalado**: o parceiro pediu telefonia, mas o app Sonax não chegou a ser instalado no portal.
- **App removido**: o app estava instalado, mas foi desinstalado depois (por engano ou durante uma manutenção).
- **Portal diferente**: a operação foi disparada apontando para um portal onde o Sonax não existe.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.app.not_installed`.
3. Confirme com o parceiro, dentro do Bitrix24 dele, se o app Sonax aparece na lista de aplicativos instalados e ativos.

## Como resolver
1. Peça ao parceiro para verificar se o app Sonax está instalado no Bitrix24 dele.
2. Se não estiver, oriente a instalação do app Sonax no portal.
3. Após instalar, confirme que o app está ativo e peça para repetir a ação que gerou o erro.
4. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se o parceiro confirma que o app Sonax está instalado e ativo, e mesmo assim o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.app.not_installed`, domínio do parceiro e o horário do evento.
