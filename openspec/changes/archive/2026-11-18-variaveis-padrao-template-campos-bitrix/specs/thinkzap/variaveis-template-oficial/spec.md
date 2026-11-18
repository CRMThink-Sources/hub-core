# Spec Delta

## Purpose

Permite ligar cada variável de um template do WhatsApp Oficial a um campo do Bitrix24, por tipo de entidade, para que o widget de envio já traga as variáveis preenchidas com os dados do registro aberto.

## ADDED Requirements

### Requirement: Ação "Variáveis padrão" na lista de templates
A lista de templates de uma linha oficial SHALL oferecer, em todo template cujo corpo tenha ao menos uma variável, a ação de definir as variáveis padrão do envio. Template sem variáveis SHALL NOT oferecer a ação. A ação SHALL valer também para templates criados fora do ThinkZap e trazidos pela sincronização, e SHALL ficar indisponível para quem não tem permissão de alterar conectores.

O diálogo SHALL pedir primeiro o tipo de entidade (Lead, Negócio, Contato, Empresa ou uma SPA) e, para o tipo escolhido, listar cada variável do corpo, na ordem em que aparece, com um seletor de campo do Bitrix. O diálogo SHALL mostrar o mapeamento já salvo para o tipo escolhido, e SHALL permitir deixar uma variável sem campo.

#### Scenario: Template com variáveis oferece a ação
- **WHEN** o operador abre o menu de um template aprovado com corpo `Olá {{1}}, seu pedido {{2}} saiu`
- **THEN** o menu mostra "Variáveis padrão"

#### Scenario: Template sem variáveis não oferece a ação
- **WHEN** o operador abre o menu de um template com corpo `Bem-vindo à nossa loja`
- **THEN** o menu não mostra "Variáveis padrão"

#### Scenario: Mapeamento já salvo reaparece
- **WHEN** o operador reabre o diálogo de um template em que `{{1}}` foi ligada ao campo "Título" do Negócio e escolhe o tipo Negócio
- **THEN** `{{1}}` aparece com "Título" selecionado e `{{2}}` sem campo

#### Scenario: Cada tipo de entidade tem seu mapeamento
- **WHEN** o operador liga `{{1}}` ao "Título" do Negócio e, no mesmo diálogo, escolhe o tipo Contato
- **THEN** o diálogo mostra o mapeamento de Contato, sem herdar o de Negócio

### Requirement: Campos disponíveis para ligar
O seletor de campo SHALL listar os campos da entidade escolhida, com o nome legível e distinguindo campos personalizados. Para Lead, Negócio e SPA, o seletor SHALL listar também os campos do Contato e da Empresa vinculados; para Contato, os da Empresa vinculada. Um campo de entidade vinculada SHALL aparecer identificado pela entidade de origem (ex.: "Contato › Nome").

#### Scenario: Negócio oferece campos do Contato e da Empresa
- **WHEN** o operador escolhe o tipo Negócio no diálogo
- **THEN** o seletor lista os campos do Negócio, do Contato e da Empresa, estes dois identificados pela origem

#### Scenario: Empresa oferece só os próprios campos
- **WHEN** o operador escolhe o tipo Empresa no diálogo
- **THEN** o seletor lista apenas campos da Empresa

#### Scenario: Falha ao ler os campos do Bitrix
- **WHEN** o Bitrix não responde ao listar os campos
- **THEN** o diálogo informa que não foi possível carregar os campos e não permite salvar alterações nessa tela

### Requirement: Guardar o mapeamento por template e tipo de entidade
O ThinkZap SHALL guardar o mapeamento de variáveis identificado pela linha, pelo nome e pelo idioma do template e pelo tipo de entidade, de modo que ele sobreviva à edição do template. Salvar de novo SHALL substituir o mapeamento anterior do mesmo tipo. A API SHALL recusar, sem guardar nada, um mapeamento que cite variável inexistente no corpo do template, que cite entidade de origem não permitida para o tipo (ex.: Contato em um mapeamento de Empresa) ou que seja pedido para uma linha bloqueada ou para template que não existe na linha.

Variável sem campo SHALL ser guardada como não mapeada. Quando todas as variáveis ficam sem campo, o mapeamento daquele tipo SHALL deixar de existir.

#### Scenario: Salvar o mapeamento
- **WHEN** o operador liga `{{1}}` a "Contato › Nome" e `{{2}}` a "Valor" no tipo Negócio e salva
- **THEN** o ThinkZap guarda as duas ligações para esse template no tipo Negócio

#### Scenario: Substituir o mapeamento
- **WHEN** o operador salva de novo o tipo Negócio ligando só `{{1}}` a "Título"
- **THEN** o mapeamento do tipo Negócio fica apenas com `{{1}}` ligada a "Título"

#### Scenario: Variável que não existe no corpo
- **WHEN** chega um pedido que liga `{{9}}` em um template cujo corpo só tem `{{1}}`
- **THEN** o pedido é recusado e nada é guardado

#### Scenario: Origem não permitida
- **WHEN** chega um pedido, para o tipo Empresa, que liga uma variável a um campo do Contato vinculado
- **THEN** o pedido é recusado e nada é guardado

#### Scenario: Mapeamento sobrevive à edição do template
- **WHEN** o operador edita o texto de um template que tem variáveis mapeadas, mantendo nome e idioma
- **THEN** o mapeamento continua valendo para as variáveis que seguem no corpo

#### Scenario: Limpar o mapeamento
- **WHEN** o operador deixa todas as variáveis do tipo Negócio sem campo e salva
- **THEN** o template deixa de ter mapeamento para o tipo Negócio

### Requirement: Widget preenche as variáveis a partir do CRM
No widget aberto em uma entidade, ao escolher um template que tem mapeamento para o tipo dessa entidade, o widget SHALL pedir ao servidor os valores dos campos mapeados daquele registro e SHALL preencher as variáveis correspondentes. O servidor SHALL ler o registro e, quando o mapeamento pede, o Contato e a Empresa vinculados; quando houver mais de um Contato vinculado, SHALL usar o principal (o marcado como principal e, na falta dele, o primeiro).

Um valor SHALL chegar como texto pronto para o corpo: campo de lista traz o rótulo da opção (não o código); campo de telefone ou e-mail traz o primeiro valor; campo de vários valores traz os valores separados por vírgula; campo de data traz a data no formato `dd/mm/aaaa`; campo de dinheiro traz o número sem a moeda; campo sim/não traz "Sim" ou "Não". Campo vazio ou registro vinculado inexistente SHALL deixar a variável sem preenchimento, e nunca com texto como `null` ou `undefined`.

O operador SHALL poder editar qualquer valor preenchido antes de enviar. Valor que o operador já digitou SHALL NOT ser sobrescrito pelo preenchimento automático, e trocar de template SHALL descartar o preenchimento do anterior. O envio SHALL continuar exigindo todas as variáveis preenchidas.

#### Scenario: Preenchimento no Negócio
- **WHEN** o operador abre o widget no Negócio "Proposta ACME", escolhe o template com `{{1}}` ligada a "Contato › Nome" (Maria) e `{{2}}` ligada a "Título"
- **THEN** o widget mostra `{{1}}` = "Maria" e `{{2}}` = "Proposta ACME", e o envio fica liberado

#### Scenario: Operador edita o valor preenchido
- **WHEN** o widget preencheu `{{1}}` com "Maria" e o operador troca por "Maria Souza" e envia
- **THEN** o template é enviado com "Maria Souza"

#### Scenario: Campo vazio no CRM
- **WHEN** a variável está ligada a um campo vazio do registro
- **THEN** a variável fica em branco e o envio fica bloqueado até o operador preencher

#### Scenario: Campo de lista
- **WHEN** a variável está ligada a um campo de lista cuja opção escolhida é "Em negociação"
- **THEN** a variável é preenchida com "Em negociação"

#### Scenario: Entidade sem mapeamento
- **WHEN** o template tem mapeamento só para Negócio e o widget está aberto em um Lead
- **THEN** nenhuma variável é preenchida e o widget funciona como hoje

#### Scenario: Valor digitado não é sobrescrito
- **WHEN** o operador digita "Ana" em `{{1}}` antes de a resposta do servidor chegar
- **THEN** `{{1}}` continua "Ana" e só as variáveis vazias recebem o valor do CRM

#### Scenario: Falha ao ler o CRM
- **WHEN** o Bitrix falha ao ler o registro
- **THEN** o widget deixa as variáveis vazias, sem mensagem de erro que impeça o envio

#### Scenario: Troca de template
- **WHEN** o operador escolhe outro template depois de o widget ter preenchido as variáveis do primeiro
- **THEN** os valores do primeiro não passam para o segundo
