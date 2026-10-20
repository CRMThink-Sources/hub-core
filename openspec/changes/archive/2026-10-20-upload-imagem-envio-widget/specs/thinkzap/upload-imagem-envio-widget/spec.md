# Spec Delta

## Purpose

Permite que o operador do widget do CRM envie o arquivo da imagem do cabeçalho de um template, em vez de colar uma URL, com o ThinkZap hospedando a imagem temporariamente e usando a URL gerada no envio.

## ADDED Requirements

### Requirement: Widget oferece arquivo ou link para a imagem do cabeçalho
Ao escolher um template com cabeçalho de imagem, o widget SHALL oferecer duas formas de informar a imagem: enviar um arquivo ou informar uma URL pública `https`. Quando o upload estiver disponível no ambiente, a forma padrão SHALL ser o arquivo. Quando não estiver, o widget SHALL oferecer só a URL, como antes desta mudança.

O widget SHALL aceitar apenas arquivos JPEG ou PNG de até 5 MB e SHALL recusar outros arquivos antes de enviá-los, informando o motivo.

#### Scenario: Upload disponível
- **WHEN** o operador escolhe um template com imagem num ambiente com upload configurado
- **THEN** o widget mostra as opções "Enviar arquivo" (selecionada) e "Usar link"

#### Scenario: Upload indisponível
- **WHEN** o operador escolhe um template com imagem num ambiente sem upload configurado
- **THEN** o widget mostra só o campo de URL

#### Scenario: Arquivo fora do formato
- **WHEN** o operador escolhe um PDF ou uma imagem de 7 MB
- **THEN** o widget não envia o arquivo e informa que a imagem precisa ser JPEG ou PNG de até 5 MB

### Requirement: Upload da imagem gera uma URL pública
O sistema SHALL receber o arquivo da imagem do cabeçalho de um usuário autenticado do widget, SHALL confirmar pelo conteúdo que é JPEG ou PNG e que tem até 5 MB, e SHALL devolver uma URL pública `https` que entrega o próprio arquivo da imagem.

A URL SHALL ser impossível de adivinhar a partir de outras URLs geradas. O arquivo SHALL ser guardado apenas pelo tempo necessário ao envio e aos reenvios, e SHALL deixar de estar disponível em até 30 dias.

O sistema SHALL recusar, sem guardar nada, arquivo que não seja JPEG/PNG pelo conteúdo (inclusive com extensão trocada) ou maior que 5 MB, com mensagem que identifique o problema.

#### Scenario: Upload de PNG válido
- **WHEN** o operador envia `promo.png` de 300 KB
- **THEN** o sistema devolve uma URL `https` pública que, aberta, entrega a imagem PNG

#### Scenario: Arquivo renomeado
- **WHEN** um pedido de upload chega com um PDF renomeado para `promo.png`
- **THEN** o sistema recusa informando que a imagem precisa ser JPEG ou PNG, e nada é guardado

#### Scenario: Arquivo grande demais
- **WHEN** um pedido de upload chega com um arquivo de 8 MB
- **THEN** o sistema recusa informando que a imagem passa de 5 MB

#### Scenario: Armazenamento indisponível
- **WHEN** o armazenamento não está configurado ou não responde no upload
- **THEN** o sistema responde com erro legível sugerindo informar um link, e o operador continua podendo enviar o template por link

### Requirement: Envio usa a imagem enviada
Depois do upload, o widget SHALL mostrar a imagem enviada no preview acima do corpo e SHALL enviar o template com a URL gerada como imagem do cabeçalho, pelo mesmo caminho do envio por link. O envio SHALL ficar desabilitado enquanto o upload não terminar ou se ele falhar.

Reenvios e reprocessamentos da fila SHALL usar a mesma URL gravada no pedido original.

#### Scenario: Envio com arquivo
- **WHEN** o operador envia `promo.png`, preenche o corpo e clica em enviar
- **THEN** o template é enviado com a URL gerada para `promo.png` no cabeçalho

#### Scenario: Upload em andamento
- **WHEN** o upload do arquivo ainda não terminou
- **THEN** o botão de enviar fica desabilitado

#### Scenario: Reprocessamento
- **WHEN** um envio com imagem enviada por arquivo falha temporariamente e é reprocessado pela fila
- **THEN** o reenvio usa a mesma URL de imagem do pedido original
