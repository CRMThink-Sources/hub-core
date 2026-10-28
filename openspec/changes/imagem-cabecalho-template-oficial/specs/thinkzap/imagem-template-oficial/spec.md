# Spec Delta

## Purpose

Define como o ThinkZap cria templates do WhatsApp Oficial com cabeçalho de imagem, guarda uma imagem padrão do envio para cada template e envia esses templates pelo widget do CRM e pelo robô do Bitrix24, com a imagem padrão ou com uma imagem informada no envio.

## ADDED Requirements

### Requirement: Criar template com cabeçalho de imagem na linha oficial
O formulário de criação de template de uma linha oficial SHALL oferecer um cabeçalho opcional do tipo imagem. Com o cabeçalho de imagem escolhido, o formulário SHALL exigir uma imagem de exemplo, enviada como arquivo JPEG ou PNG de até 5 MB ou informada como URL pública `https` de um arquivo JPEG ou PNG, e SHALL mostrar a imagem no preview acima do corpo.

O cabeçalho de imagem SHALL NOT ser oferecido na categoria Autenticação. Ao trocar para Autenticação, o cabeçalho escolhido SHALL ser removido.

Template sem cabeçalho SHALL continuar sendo criado exatamente como hoje, e o cabeçalho SHALL poder ser combinado com rodapé e botões.

#### Scenario: Template de Marketing com imagem
- **WHEN** o operador cria um template de Marketing com cabeçalho de imagem, exemplo `https://loja.com/banner.png` e corpo `Oferta {{1}}`
- **THEN** o template é enviado ao provedor com o cabeçalho de imagem e aparece na lista como pendente

#### Scenario: Template com imagem por arquivo
- **WHEN** o operador escolhe o cabeçalho de imagem e anexa o arquivo `banner.png` de 300 KB
- **THEN** o template é enviado ao provedor com a imagem e aparece na lista como pendente

#### Scenario: Arquivo inválido no formulário
- **WHEN** o operador anexa um arquivo de 7 MB ou um PDF como imagem de exemplo
- **THEN** o formulário não permite criar o template e informa que a imagem precisa ser JPEG ou PNG de até 5 MB

#### Scenario: Cabeçalho de imagem sem exemplo
- **WHEN** o operador escolhe o cabeçalho de imagem e deixa o exemplo vazio
- **THEN** o formulário não permite criar o template e indica que a imagem de exemplo é obrigatória

#### Scenario: Exemplo que não é https
- **WHEN** o operador informa `http://loja.com/banner.png` como exemplo
- **THEN** o formulário não permite criar o template e informa que a URL precisa ser `https`

#### Scenario: Autenticação remove o cabeçalho
- **WHEN** o operador tem um cabeçalho de imagem e muda a categoria para Autenticação
- **THEN** o cabeçalho é removido e a opção deixa de ser oferecida

### Requirement: API valida o cabeçalho de imagem na criação
A API de criação de template SHALL aceitar no máximo um componente de cabeçalho com formato imagem e uma imagem de exemplo, enviada como arquivo ou informada como URL — exatamente uma das duas. SHALL recusar com o erro de definição inválida de template, sem chamar o provedor, um pedido com mais de um cabeçalho, com cabeçalho de formato diferente de imagem, sem exemplo, com arquivo e URL ao mesmo tempo, com exemplo que não seja URL `https`, com exemplo hospedado no CDN da Meta (`whatsapp.net`, `fbcdn.net`, `fbsbx.com`), com arquivo que não seja JPEG/PNG pelo conteúdo ou maior que 5 MB, ou com cabeçalho em template de Autenticação.

Se o provedor recusar o envio do arquivo por falta das credenciais da Meta na conta, a API SHALL responder com uma mensagem dizendo que o envio de arquivo não está disponível e que o operador pode usar um link.

Se a imagem de exemplo não puder ser obtida (URL inacessível, arquivo que não é JPEG/PNG ou maior que 5 MB), a API SHALL recusar com o erro de definição inválida de template e uma mensagem que identifique o problema com a imagem.

Uma recusa da Meta ao cabeçalho SHALL chegar ao operador com a mensagem legível, como as demais recusas da Meta.

#### Scenario: API recusa cabeçalho de vídeo
- **WHEN** um pedido de criação chega com um cabeçalho de formato vídeo
- **THEN** a API responde com o erro de definição inválida de template e nada é enviado ao provedor

#### Scenario: Exemplo copiado de um template da Meta
- **WHEN** um pedido de criação chega com exemplo `https://scontent.whatsapp.net/v/t61/abc.jpg`
- **THEN** a API responde com o erro de definição inválida de template, informando que link do WhatsApp/Meta não vale como amostra e que é preciso usar o link do próprio arquivo

#### Scenario: Imagem de exemplo grande demais
- **WHEN** um pedido de criação chega com um exemplo que aponta para uma imagem de 8 MB
- **THEN** a API responde com o erro de definição inválida de template, informando que a imagem passa de 5 MB

#### Scenario: API repassa cabeçalho válido
- **WHEN** um pedido de criação chega com cabeçalho de imagem, exemplo PNG acessível de 300 KB e corpo
- **THEN** a API envia ao provedor o template com o cabeçalho de imagem e a imagem de exemplo

#### Scenario: API envia o arquivo ao provedor
- **WHEN** um pedido de criação chega com cabeçalho de imagem e um arquivo PNG de 300 KB
- **THEN** a API entrega a imagem ao provedor e cria o template com o cabeçalho de imagem

#### Scenario: Armazenamento da imagem indisponível
- **WHEN** um pedido de criação chega com arquivo e o armazenamento da imagem está fora do ar
- **THEN** a API responde com erro dizendo que o envio de arquivo está indisponível e que o operador pode usar um link, e nada é enviado ao provedor

#### Scenario: Upload indisponível na conta
- **WHEN** o provedor recusa o envio do arquivo porque a conta não tem as credenciais da Meta cadastradas
- **THEN** a API responde com um erro dizendo que o envio de arquivo não está disponível e que o operador pode usar um link

### Requirement: Lista de templates indica o cabeçalho de imagem
A lista de templates da linha oficial SHALL indicar quais templates têm cabeçalho de imagem. Isso SHALL valer também para templates criados fora do ThinkZap e trazidos pela sincronização.

#### Scenario: Template sincronizado com imagem
- **WHEN** a linha tem um template aprovado criado direto na Meta com cabeçalho de imagem
- **THEN** a lista mostra o template identificado como template com imagem

### Requirement: Catálogo de envio informa o cabeçalho
O catálogo de templates aprovados oferecido ao widget e à tela do robô SHALL informar o tipo de cabeçalho de cada template: nenhum, texto ou imagem. Template com cabeçalho de imagem SHALL ser oferecido e SHALL informar a imagem padrão do envio, quando houver.

Template com cabeçalho de vídeo, documento, localização ou texto com variável SHALL NOT ser oferecido no catálogo de envio, porque o ThinkZap não tem como preencher esses cabeçalhos.

#### Scenario: Template com imagem no catálogo
- **WHEN** o widget carrega os templates de uma linha com um template aprovado que tem cabeçalho de imagem
- **THEN** o template vem marcado com cabeçalho de imagem e, se tiver imagem padrão, com a URL dela

#### Scenario: Template com vídeo fora do catálogo
- **WHEN** a linha tem um template aprovado com cabeçalho de vídeo, criado na Meta
- **THEN** esse template não aparece no catálogo do widget nem no do robô

### Requirement: Imagem padrão do envio por template
O ThinkZap SHALL guardar, para cada template com cabeçalho de imagem de uma linha oficial, uma imagem padrão do envio, identificada pela linha, pelo nome e pelo idioma do template. A imagem padrão SHALL ficar disponível por URL pública `https` sem prazo de expiração.

Ao criar um template com cabeçalho de imagem pelo ThinkZap, a imagem de exemplo SHALL passar a ser a imagem padrão do envio desse template. Uma falha ao guardar a imagem padrão SHALL NOT desfazer a criação do template.

A lista de templates SHALL oferecer, em cada template com cabeçalho de imagem, a ação de definir ou trocar a imagem padrão, por arquivo JPEG/PNG de até 5 MB ou por URL pública `https`. Essa ação SHALL valer também para templates criados fora do ThinkZap e trazidos pela sincronização. A imagem padrão SHALL passar pelas mesmas validações da imagem de exemplo, incluindo a recusa de link do CDN da Meta.

#### Scenario: Criação define a imagem padrão
- **WHEN** o operador cria um template de Marketing com o arquivo `banner.png` como imagem de exemplo
- **THEN** o template passa a ter `banner.png` como imagem padrão do envio

#### Scenario: Definir imagem padrão de template sincronizado
- **WHEN** a linha tem um template com imagem criado direto na Meta e o operador define `https://loja.com/promo.png` como imagem padrão pela lista
- **THEN** o template passa a ter essa imagem padrão, e o widget e o robô passam a usá-la

#### Scenario: Link da Meta recusado como imagem padrão
- **WHEN** o operador informa `https://scontent.whatsapp.net/v/t61/abc.jpg` como imagem padrão
- **THEN** a imagem é recusada com a mensagem de que link do WhatsApp/Meta expira e é preciso usar o link do próprio arquivo

#### Scenario: Imagem padrão em template sem imagem
- **WHEN** um pedido para definir imagem padrão chega para um template sem cabeçalho de imagem
- **THEN** o pedido é recusado e nada é guardado

### Requirement: Widget usa a imagem padrão e permite trocar
No widget do CRM, ao escolher um template com cabeçalho de imagem que tem imagem padrão, o widget SHALL mostrar a imagem padrão no preview acima do corpo e SHALL permitir enviar sem informar outra imagem. O operador SHALL poder trocar a imagem daquele envio por um arquivo ou uma URL pública `https`, sem alterar a imagem padrão do template.

Sem imagem padrão, o widget SHALL pedir a imagem, e o envio SHALL ficar desabilitado enquanto nenhuma imagem válida for informada.

Template sem cabeçalho de imagem SHALL ser enviado como hoje, sem o campo.

#### Scenario: Envio com a imagem padrão
- **WHEN** o operador escolhe um template cuja imagem padrão é `https://cdn.thinkzap/banner.png` e preenche o corpo
- **THEN** o envio fica liberado e o template é enviado com essa imagem no cabeçalho

#### Scenario: Troca da imagem só no envio
- **WHEN** o operador escolhe um template com imagem padrão, troca a imagem por `https://loja.com/promo.jpg` e envia
- **THEN** o template é enviado com `https://loja.com/promo.jpg`, e a imagem padrão do template continua a mesma

#### Scenario: Template sem imagem padrão bloqueia o envio
- **WHEN** o operador escolhe um template com imagem sem imagem padrão, preenche o corpo e não informa imagem
- **THEN** o botão de enviar fica desabilitado

### Requirement: Robô de template envia a imagem do cabeçalho
O robô de envio de template do Bitrix24 SHALL ter uma propriedade opcional para a URL da imagem do cabeçalho. Na tela de configuração do robô, um template com cabeçalho de imagem SHALL exibir esse campo, que aceita valor fixo ou campo do documento, e o preview SHALL mostrar o cabeçalho com a imagem padrão quando o campo estiver vazio. A tela SHALL impedir salvar com o campo vazio apenas quando o template não tiver imagem padrão.

No disparo, uma URL resolvida vazia SHALL ser substituída pela imagem padrão do template. Se não houver nenhuma das duas, ou se a URL informada não for `https`, o robô SHALL registrar a falha na timeline do documento sem enfileirar nada. Robôs configurados antes desta mudança, sem a nova propriedade, SHALL continuar funcionando para templates sem cabeçalho de imagem e SHALL usar a imagem padrão em templates com imagem.

#### Scenario: Robô com imagem vinda do negócio
- **WHEN** o robô está configurado com um template com imagem, com a URL ligada a um campo do negócio que contém `https://loja.com/produto-42.png`, e é disparado
- **THEN** o template é enviado com essa imagem no cabeçalho

#### Scenario: Campo vazio usa a imagem padrão
- **WHEN** o robô é disparado, o campo do negócio ligado à imagem está vazio e o template tem imagem padrão
- **THEN** o template é enviado com a imagem padrão no cabeçalho

#### Scenario: Sem imagem nenhuma no disparo
- **WHEN** o robô é disparado, o campo do negócio ligado à imagem está vazio e o template não tem imagem padrão
- **THEN** nada é enfileirado e a timeline do negócio registra que o template exige uma imagem que não foi informada

#### Scenario: Robô antigo sem imagem
- **WHEN** um robô salvo antes desta mudança, com um template sem cabeçalho, é disparado
- **THEN** o template é enviado normalmente

### Requirement: Envio ao provedor inclui a imagem do cabeçalho
Ao enviar um template com cabeçalho de imagem, o sistema SHALL incluir o componente de cabeçalho com a imagem por URL, antes do corpo e dos botões. A URL que valeu no envio (a informada ou a imagem padrão) SHALL ficar gravada na fila de envio junto com os valores do corpo e dos botões, de modo que reenvios e reprocessamentos usem a mesma imagem, mesmo que a imagem padrão mude depois.

Envio sem imagem SHALL continuar com o mesmo formato atual. Se a Meta recusar o envio porque não conseguiu baixar a imagem, a falha SHALL aparecer na timeline como as demais falhas de envio de template.

#### Scenario: Envio com imagem, corpo e botão
- **WHEN** um template com imagem, uma variável no corpo e um link dinâmico é enviado com a imagem `https://loja.com/a.png`, o corpo "Ana" e o link "PED-1"
- **THEN** o envio ao provedor leva o cabeçalho com a imagem, o corpo com "Ana" e o botão com "PED-1"

#### Scenario: Reprocessamento usa a mesma imagem
- **WHEN** um envio de template com imagem falha temporariamente e é reprocessado pela fila
- **THEN** o reenvio leva a mesma URL de imagem gravada no primeiro pedido

#### Scenario: Imagem padrão trocada com envio na fila
- **WHEN** um envio com a imagem padrão `A` está na fila e o operador troca a imagem padrão para `B` antes do reprocessamento
- **THEN** o reprocessamento leva a imagem `A`

### Requirement: Campanha SMS recusa template com imagem
A campanha SMS do Bitrix24 SHALL recusar o envio de um template com cabeçalho de imagem, sem enfileirar mensagem, informando ao Bitrix que o template exige uma imagem que a campanha não fornece. A tela de configuração da campanha SHALL sinalizar esses templates como indisponíveis para a campanha, como já faz com botão dinâmico.

#### Scenario: Campanha com template de imagem
- **WHEN** a campanha SMS envia por um template aprovado que tem cabeçalho de imagem
- **THEN** o envio é recusado com o motivo de cabeçalho de imagem não suportado e nenhuma mensagem é enfileirada
