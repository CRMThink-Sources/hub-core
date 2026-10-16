# Spec Delta

## Purpose

Define como o ThinkZap permite criar templates do WhatsApp Oficial com botões (resposta rápida, link, ligação e copiar código), exibir esses botões e preencher os valores dos botões dinâmicos ao enviar o template pelo widget do CRM e pelo robô do Bitrix24.

## ADDED Requirements

### Requirement: Criar template com botões na linha oficial
O formulário de criação de template de uma linha oficial SHALL permitir adicionar botões dos tipos:
- **resposta rápida**: só o texto do botão;
- **link**: texto e URL. A URL SHALL poder ser fixa ou terminar com a variável `{{1}}`; com variável, o formulário SHALL exigir uma URL de exemplo completa;
- **ligação**: texto e telefone com código do país;
- **copiar código**: só o código de exemplo; o texto do botão é definido pelo WhatsApp.

O formulário SHALL aplicar os limites da Meta antes de enviar: no máximo 10 botões no total, 2 de link, 1 de ligação e 1 de copiar código; texto do botão com até 25 caracteres; telefone com até 20 caracteres; código de exemplo com até 15 caracteres. Atingido o limite de um tipo, o botão de adicionar daquele tipo SHALL ficar desabilitado. Um botão com campo obrigatório vazio ou inválido SHALL bloquear a criação, indicando o campo.

Os botões SHALL ser enviados ao provedor com todas as respostas rápidas juntas, antes dos demais botões, independentemente da ordem em que foram adicionados.

Botões SHALL NOT ser oferecidos na categoria Autenticação. O botão de copiar código SHALL ser oferecido apenas na categoria Marketing; ao trocar a categoria, os botões que deixam de ser permitidos SHALL ser removidos.

Template sem botões SHALL continuar sendo criado exatamente como hoje.

#### Scenario: Template com resposta rápida e link fixo
- **WHEN** o operador cria um template de Marketing com corpo, um botão de resposta rápida "Quero saber mais" e um botão de link "Ver oferta" para `https://loja.com/oferta`
- **THEN** o template é enviado ao provedor com os dois botões e aparece na lista como pendente

#### Scenario: Link com variável exige exemplo
- **WHEN** o operador adiciona um botão de link com a URL `https://loja.com/pedido/{{1}}` e deixa o exemplo vazio
- **THEN** o formulário não permite criar o template e indica que o exemplo da URL é obrigatório

#### Scenario: Variável fora do final da URL
- **WHEN** o operador informa a URL `https://loja.com/{{1}}/detalhes`
- **THEN** o formulário não permite criar o template e informa que a variável só pode ficar no final da URL

#### Scenario: Limite de ligação
- **WHEN** o operador já adicionou um botão de ligação
- **THEN** a opção de adicionar ligação fica desabilitada

#### Scenario: Respostas rápidas agrupadas
- **WHEN** o operador adiciona, nesta ordem, um link, uma resposta rápida e uma ligação
- **THEN** o template é enviado ao provedor com a resposta rápida primeiro, seguida do link e da ligação

#### Scenario: Copiar código fora de Marketing
- **WHEN** o operador tem um botão de copiar código num template de Marketing e muda a categoria para Utilidade
- **THEN** o botão de copiar código é removido e a opção deixa de ser oferecida

#### Scenario: Autenticação sem botões
- **WHEN** o operador escolhe a categoria Autenticação
- **THEN** a seção de botões não é exibida e o template é criado sem botões

### Requirement: API valida botões na criação de template
A API de criação de template SHALL aceitar o componente de botões com os quatro tipos suportados e SHALL recusar, sem chamar o provedor e com o erro de definição inválida de template, um pedido que viole os limites descritos em "Criar template com botões na linha oficial" ou que traga um tipo de botão não suportado.

#### Scenario: API recusa três botões de link
- **WHEN** um pedido de criação chega com três botões de link
- **THEN** a API responde com o erro de definição inválida de template e nada é enviado ao provedor

#### Scenario: API repassa botões válidos
- **WHEN** um pedido de criação chega com uma resposta rápida e um link com variável e exemplo
- **THEN** a API envia ao provedor o componente de botões com os dois botões, a URL e o exemplo

### Requirement: Lista de templates mostra os botões
A lista de templates da linha oficial SHALL exibir, para cada template que tenha botões, o texto de cada botão e o seu tipo. Isso SHALL valer também para templates criados fora do ThinkZap e trazidos pela sincronização.

#### Scenario: Template sincronizado com botões
- **WHEN** a linha tem um template aprovado criado direto na Meta com um botão de ligação "Falar com a loja"
- **THEN** a lista mostra o template com o botão "Falar com a loja" identificado como ligação

### Requirement: Catálogo de envio informa botões dinâmicos
O catálogo de templates aprovados oferecido ao widget e à tela do robô SHALL informar os botões de cada template, na ordem do template, com texto e tipo, indicando quais são **dinâmicos** — link com variável na URL e copiar código. Os botões de resposta rápida, ligação e link fixo SHALL ser tratados como estáticos e não pedem valor no envio.

Botão de um tipo não reconhecido SHALL aparecer no catálogo como estático, sem impedir o template de ser oferecido.

#### Scenario: Template com link dinâmico
- **WHEN** o widget carrega os templates de uma linha que tem um template aprovado com uma resposta rápida e um link `https://loja.com/pedido/{{1}}`
- **THEN** o template vem com dois botões, e apenas o link é marcado como dinâmico

### Requirement: Widget pede valores dos botões dinâmicos
No widget do CRM, ao escolher um template com botões, o preview SHALL exibir os botões abaixo do corpo. Para cada botão dinâmico, o widget SHALL exibir um campo identificado pelo texto do botão — para link, o valor que completa a URL; para copiar código, o código. O envio SHALL ficar desabilitado enquanto algum campo de botão dinâmico estiver vazio.

Template sem botões dinâmicos SHALL ser enviado como hoje, sem campos extras.

#### Scenario: Envio com link dinâmico
- **WHEN** o operador escolhe um template com corpo `Seu pedido {{1}} saiu` e link dinâmico "Rastrear", preenche o corpo com "PED-1" e o link com "PED-1"
- **THEN** o template é enviado com "PED-1" no corpo e "PED-1" como valor do botão "Rastrear"

#### Scenario: Botão dinâmico vazio bloqueia o envio
- **WHEN** o operador preenche todas as variáveis do corpo, mas deixa vazio o campo do botão "Rastrear"
- **THEN** o botão de enviar fica desabilitado

#### Scenario: Botões estáticos no preview
- **WHEN** o operador escolhe um template com duas respostas rápidas
- **THEN** o preview mostra os dois botões e nenhum campo extra é exibido

### Requirement: Robô de template envia valores dos botões dinâmicos
O robô de envio de template do Bitrix24 SHALL ter uma propriedade para os valores dos botões dinâmicos, na ordem em que esses botões aparecem no template. Na tela de configuração do robô, cada botão dinâmico do template escolhido SHALL ter um campo que aceite valor fixo ou campo do documento, e o preview SHALL exibir os botões. A tela SHALL impedir salvar com campo de botão dinâmico vazio.

No disparo, os valores SHALL ser enviados com o template para cada destinatário. Robôs configurados antes desta mudança, sem a nova propriedade, SHALL continuar funcionando para templates sem botões dinâmicos.

#### Scenario: Robô com cupom vindo do negócio
- **WHEN** o robô está configurado com um template de Marketing que tem botão de copiar código, com o valor ligado a um campo do negócio que contém "BLACK10", e é disparado
- **THEN** o template é enviado com "BLACK10" como código do botão

#### Scenario: Robô antigo sem botões dinâmicos
- **WHEN** um robô salvo antes desta mudança, com um template sem botões dinâmicos, é disparado
- **THEN** o template é enviado normalmente

### Requirement: Envio ao provedor inclui os botões dinâmicos
Ao enviar um template com valores de botões dinâmicos, o sistema SHALL incluir, para cada botão dinâmico, o valor associado à posição desse botão no template (contando todos os botões, a partir de zero). Os valores SHALL ficar gravados na fila de envio junto com os valores do corpo, de modo que reenvios e reprocessamentos usem os mesmos valores.

Envio sem valores de botões SHALL continuar com o mesmo formato atual.

#### Scenario: Link dinâmico na segunda posição
- **WHEN** um template tem uma resposta rápida na posição 0 e um link dinâmico na posição 1, e é enviado com o valor "PED-1" para o link
- **THEN** o envio ao provedor leva o valor "PED-1" associado ao botão de link na posição 1, e nenhum valor para a resposta rápida

#### Scenario: Reprocessamento usa os mesmos valores
- **WHEN** um envio de template com valor de botão falha temporariamente e é reprocessado pela fila
- **THEN** o reenvio leva o mesmo valor de botão gravado no primeiro pedido

### Requirement: Campanha SMS recusa template com botão dinâmico
A campanha SMS do Bitrix24 SHALL recusar o envio de um template que tenha botão dinâmico, sem enfileirar mensagem, informando ao Bitrix que o template exige valores de botão que a campanha não fornece. Templates com botões apenas estáticos SHALL continuar sendo enviados pela campanha.

#### Scenario: Campanha com link dinâmico
- **WHEN** a campanha SMS envia por um template aprovado que tem um link dinâmico
- **THEN** o envio é recusado com o motivo de botão dinâmico não suportado e nenhuma mensagem é enfileirada

#### Scenario: Campanha com resposta rápida
- **WHEN** a campanha SMS envia por um template aprovado que tem apenas botões de resposta rápida
- **THEN** a mensagem é enfileirada e enviada como hoje

### Requirement: Clique em resposta rápida chega ao chat
Quando o contato clica num botão de resposta rápida de um template, a resposta SHALL chegar ao chat do canal aberto como mensagem do contato com o texto do botão, sem tratamento adicional.

#### Scenario: Contato toca na resposta rápida
- **WHEN** o contato recebe um template com a resposta rápida "Quero saber mais" e toca nela
- **THEN** o chat do canal aberto recebe a mensagem "Quero saber mais" do contato
