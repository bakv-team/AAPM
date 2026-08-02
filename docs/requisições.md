                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            ''''''''# AAPM — Especificação de Requisitos do Sistema

> **Documento:** ERS-AAPM  
> **Versão:** 1.0  
> **Data-base:** agosto de 2026  
> **Sistema:** Gestão administrativa e Ponto de Venda da AAPM  
> **Instituição:** SENAI Francisco Matarazzo

## 1. Finalidade

Este documento estabelece, de forma verificável e rastreável, os requisitos do sistema AAPM. Ele é a referência para desenvolvimento, homologação, testes, operação e futuras mudanças de escopo.

O conteúdo foi levantado a partir da aplicação existente, incluindo interface, rotas FastAPI, modelos SQLAlchemy, autenticação, migrations e integrações. Os requisitos estão divididos em:

- **RF** — requisitos funcionais: o que o sistema deve fazer;
- **RN** — regras de negócio: condições e decisões que governam os processos;
- **RNF** — requisitos não funcionais: qualidades e restrições da solução;
- **INT** — requisitos de integração: dependências e contratos externos.

### 1.1 Convenções

| Campo | Definição |
|---|---|
| Identificador | Código único usado em código, testes e registro de mudanças |
| Prioridade | **Crítica**, **Alta**, **Média** ou **Baixa** |
| Situação | **Implementado**, **Parcial** ou **Requer validação** |
| Critério de aceite | Evidência objetiva necessária para considerar o requisito atendido |

“Deve” indica obrigação. “Pode” indica comportamento opcional. Requisitos não devem ser considerados homologados apenas por estarem implementados; a homologação depende dos critérios de aceite.

## 2. Escopo do produto

O AAPM deve apoiar a operação interna da Associação de Alunos, Ex-Alunos, Pais e Mestres, centralizando:

| Dentro do escopo | Fora do escopo atual |
|---|---|
| Autenticação e recuperação de senha | Loja virtual pública |
| PDV e registro de vendas | Emissão fiscal integrada |
| Associados e desconto institucional | Adquirência/processamento bancário |
| Produtos, categorias e variações | Aplicativo móvel nativo |
| Estoque e movimentações | Gestão contábil completa |
| Pedidos e exceções de pagamento | Entrega e logística externa |
| Dashboard, relatórios e notificações | Autoatendimento do associado |
| Usuários, perfis e permissões | Integração automática com cadastro SENAI |
| Assistente e insights operacionais | Decisões autônomas realizadas por IA |

## 3. Atores e níveis de acesso

| Ator | Responsabilidade | Acesso esperado |
|---|---|---|
| Administrador | Governança integral da operação | PDV, dashboard, usuários e todos os módulos |
| Operador | Atendimento e fechamento de vendas | PDV e recursos comuns autenticados |
| Funcionário autorizado | Atividades administrativas delegadas | Somente módulos incluídos em suas permissões |
| Associado/cliente | Pessoa identificada na venda | Não possui login; é cadastrado pelo usuário interno |
| Serviço SMTP | Entrega de recuperação de senha e suporte | Integração de saída autenticada |
| Provedor de IA | Geração opcional de respostas do AAPM Smart | Recebe contexto operacional controlado pela aplicação |

As permissões granulares reconhecidas são: `smart`, `dashboard`, `products`, `charts`, `orders`, `customers`, `categories`, `stock_movements`, `stock`, `movements`, `reports` e `settings`.

## 4. Requisitos funcionais

### 4.1 Autenticação, sessão e perfil

| ID | Requisito | Prioridade | Situação | Critério de aceite |
|---|---|---:|---|---|
| RF-AUT-001 | O sistema deve exibir uma tela de autenticação por e-mail e senha. | Crítica | Implementado | `GET /auth/login` retorna a tela de login. |
| RF-AUT-002 | O sistema deve autenticar somente usuário existente, ativo e com senha válida. | Crítica | Implementado | Credenciais válidas criam sessão; e-mail inexistente, senha inválida ou usuário inativo não autenticam. |
| RF-AUT-003 | O sistema deve criar uma sessão JWT após autenticação válida. | Crítica | Implementado | A resposta grava `access_token` em cookie HttpOnly com expiração configurada. |
| RF-AUT-004 | O sistema deve redirecionar administrador ou funcionário autorizado ao dashboard e operador sem permissões ao PDV. | Alta | Implementado | O destino após o login corresponde ao perfil e às permissões. |
| RF-AUT-005 | O sistema deve encerrar a sessão e remover o cookie de acesso. | Crítica | Implementado | `GET /auth/logout` exclui `access_token` e redireciona à entrada. |
| RF-AUT-006 | O sistema deve permitir solicitar recuperação de senha por e-mail. | Alta | Implementado | Solicitação válida produz resposta neutra e, quando aplicável, envia link temporário. |
| RF-AUT-007 | A recuperação não deve revelar se um e-mail está cadastrado. | Alta | Implementado | A resposta pública é equivalente para e-mail conhecido ou desconhecido. |
| RF-AUT-008 | O sistema deve validar o token de recuperação antes de exibir ou processar a nova senha. | Crítica | Implementado | Token inválido, expirado ou com finalidade incorreta é rejeitado. |
| RF-AUT-009 | O sistema deve permitir redefinir a senha com confirmação idêntica e mínimo de seis caracteres. | Alta | Implementado | Senhas divergentes ou menores que seis caracteres não são gravadas. |
| RF-AUT-010 | O usuário autenticado deve consultar nome, e-mail, perfil e situação da própria conta. | Média | Implementado | `GET /api/v1/pdv/profile` retorna somente o perfil da sessão. |
| RF-AUT-011 | O usuário autenticado deve alterar sua senha informando a senha atual. | Alta | Implementado | A alteração exige senha atual correta e nova senha com no mínimo seis caracteres. |
| RF-AUT-012 | Requisições sem sessão válida a recursos protegidos devem ser recusadas. | Crítica | Implementado | A API responde `401` para token ausente, inválido ou expirado. |

### 4.2 Autorização e gestão de usuários

| ID | Requisito | Prioridade | Situação | Critério de aceite |
|---|---|---:|---|---|
| RF-USR-001 | O administrador deve cadastrar usuários com nome, e-mail, senha e perfil. | Alta | Implementado | Um usuário válido é persistido e aparece na gestão de funcionários. |
| RF-USR-002 | O administrador deve editar nome, e-mail, perfil, permissões e, opcionalmente, senha de um usuário. | Alta | Implementado | Os dados alterados são usados no próximo acesso. |
| RF-USR-003 | O administrador deve ativar ou desativar contas. | Alta | Implementado | Conta inativa deixa de autenticar. |
| RF-USR-004 | O sistema deve aceitar apenas os perfis `admin`, `operador` e `funcionario`. | Alta | Implementado | Perfil fora da lista não é persistido. |
| RF-USR-005 | O sistema deve impedir e-mails duplicados entre usuários. | Crítica | Implementado | Cadastro ou edição com e-mail já utilizado não cria duplicidade. |
| RF-USR-006 | O administrador não deve desativar a própria conta pela tela administrativa. | Alta | Implementado | A tentativa mantém a conta do solicitante ativa. |
| RF-USR-007 | Permissões específicas devem controlar acesso às seções do dashboard e respectivos endpoints. | Crítica | Implementado | Usuário sem a permissão recebe `403`, mesmo acessando a URL diretamente. |
| RF-USR-008 | Administradores devem ignorar restrições granulares e acessar todos os módulos. | Alta | Implementado | Rotas protegidas por permissão aceitam perfil `admin`. |
| RF-USR-009 | Permissões inválidas ou repetidas devem ser descartadas durante a normalização. | Média | Implementado | Somente chaves reconhecidas, sem duplicatas, permanecem no perfil. |

### 4.3 Categorias

| ID | Requisito | Prioridade | Situação | Critério de aceite |
|---|---|---:|---|---|
| RF-CAT-001 | Usuários autenticados devem listar categorias ativas em ordem alfabética. | Alta | Implementado | A consulta não retorna categorias inativas. |
| RF-CAT-002 | Usuário com permissão `categories` deve criar categoria. | Alta | Implementado | Nome válido cria registro ativo e retorna `201`. |
| RF-CAT-003 | Usuário com permissão `categories` deve renomear categoria ativa. | Média | Implementado | O novo nome é persistido e refletido nos produtos relacionados. |
| RF-CAT-004 | Usuário com permissão `categories` deve desativar categoria sem produtos ativos. | Média | Implementado | A exclusão lógica define `ativo = false`. |
| RF-CAT-005 | A listagem deve informar a quantidade de produtos ativos por categoria. | Média | Implementado | `productCount` corresponde aos vínculos ativos. |

### 4.4 Produtos, imagens e variações

| ID | Requisito | Prioridade | Situação | Critério de aceite |
|---|---|---:|---|---|
| RF-PRD-001 | Usuários autorizados devem listar produtos com busca, categoria, estoque e situação como filtros. | Alta | Implementado | Os filtros podem ser combinados e a resposta reflete os critérios. |
| RF-PRD-002 | A busca de produtos deve considerar nome e descrição sem exigir correspondência de maiúsculas/minúsculas. | Média | Implementado | Texto parcial compatível localiza o produto. |
| RF-PRD-003 | O filtro de estoque deve distinguir disponível, baixo e esgotado. | Alta | Implementado | Baixo estoque corresponde a saldo entre 1 e 5; esgotado, saldo menor ou igual a zero. |
| RF-PRD-004 | Usuário com permissão `products` deve cadastrar produto com nome, descrição, preço, estoque, categoria e imagem. | Alta | Implementado | Dados válidos criam e retornam o produto. |
| RF-PRD-005 | Usuário com permissão `products` deve editar dados e imagem de produto ativo. | Alta | Implementado | A consulta subsequente retorna os dados atualizados. |
| RF-PRD-006 | Usuário com permissão `products` deve ativar ou desativar produto. | Alta | Implementado | Produto inativo não aparece no catálogo padrão nem no PDV. |
| RF-PRD-007 | Usuário com permissão `products` deve excluir definitivamente um produto. | Média | Implementado | Produto, variações e movimentos vinculados são removidos sem apagar itens históricos de vendas. |
| RF-PRD-008 | O sistema deve aceitar imagens JPEG, JPG, PNG e WebP. | Média | Implementado | Arquivo válido é armazenado em `database/static/uploads`. |
| RF-PRD-009 | O sistema deve listar imagens existentes para reutilização no catálogo. | Baixa | Implementado | `GET /product-images` retorna arquivos válidos disponíveis. |
| RF-PRD-010 | O produto deve admitir variações por tamanho, cor ou combinação de ambos. | Alta | Implementado | Cada combinação é persistida como uma variação vendável. |
| RF-PRD-011 | Cada variação deve possuir preço, estoque e código interno únicos no domínio aplicável. | Alta | Implementado | A variação criada possui `codigo_produto` único e valores próprios. |
| RF-PRD-012 | O catálogo do PDV deve retornar somente produtos ativos, com categoria e variações disponíveis. | Crítica | Implementado | `GET /sale/products` não oferece produto inativo à venda. |
| RF-PRD-013 | O sistema deve reativar produto existente quando o cadastro acrescentar nova variação válida ao mesmo nome. | Média | Implementado | A variação é adicionada sem criar outro produto-base. |

### 4.5 Estoque e movimentações

| ID | Requisito | Prioridade | Situação | Critério de aceite |
|---|---|---:|---|---|
| RF-EST-001 | Usuário com permissão de estoque ou movimentações deve repor saldo de um produto ativo. | Crítica | Implementado | Quantidade positiva incrementa o saldo persistido. |
| RF-EST-002 | Em produto com variações, a reposição deve exigir a variação de destino. | Crítica | Implementado | Reposição sem variação válida é recusada. |
| RF-EST-003 | Toda reposição manual deve gerar movimentação de entrada com produto, quantidade, preço, usuário, data e observação. | Crítica | Implementado | O saldo e o registro de auditoria são confirmados juntos. |
| RF-EST-004 | Toda venda deve gerar movimentação de saída para cada produto vendido. | Crítica | Implementado | Cada item agregado da venda possui saída correspondente. |
| RF-EST-005 | Usuário autorizado deve consultar movimentações em ordem cronológica decrescente. | Alta | Implementado | Registros mais recentes aparecem primeiro. |
| RF-EST-006 | A consulta deve filtrar por produto e por tipo de movimento. | Média | Implementado | Filtros `produto_id` e `tipo` restringem o resultado. |
| RF-EST-007 | A consulta deve aceitar limite entre 1 e 200 registros, usando 80 como padrão. | Baixa | Implementado | Valores fora do intervalo são recusados pela validação. |
| RF-EST-008 | O sistema deve apresentar quantidade, preço unitário e valor total de cada movimento. | Média | Implementado | Total apresentado equivale a quantidade multiplicada pelo preço. |

### 4.6 Clientes e associados

| ID | Requisito | Prioridade | Situação | Critério de aceite |
|---|---|---:|---|---|
| RF-CLI-001 | Usuário com permissão `customers` ou `reports` deve listar clientes ativos. | Alta | Implementado | A resposta inclui dados cadastrais e resumo de compras. |
| RF-CLI-002 | A listagem deve permitir busca por nome, matrícula ou telefone. | Alta | Implementado | Texto parcial localiza registros nos três campos. |
| RF-CLI-003 | Usuário autenticado no PDV deve consultar associado por nome, matrícula ou telefone. | Crítica | Implementado | A resposta indica existência, identificação e situação de associação. |
| RF-CLI-004 | Usuário com permissão `customers` deve cadastrar cliente com nome, matrícula, telefone e indicador de associado. | Alta | Implementado | Registro válido fica disponível para consulta. |
| RF-CLI-005 | Ao cadastrar nome já existente, o sistema deve atualizar os dados disponíveis em vez de duplicar o cliente. | Média | Implementado | O cliente existente recebe matrícula, telefone e situação atualizados. |
| RF-CLI-006 | Usuário com permissão `customers` deve excluir cliente. | Média | Implementado | O cliente deixa de aparecer na listagem e suas vendas permanecem preservadas sem vínculo. |
| RF-CLI-007 | A listagem deve informar número de pedidos, total gasto e data da última compra. | Média | Implementado | Os valores são derivados das vendas vinculadas. |

### 4.7 Venda e atendimento no PDV

| ID | Requisito | Prioridade | Situação | Critério de aceite |
|---|---|---:|---|---|
| RF-VEN-001 | Usuário autenticado deve registrar venda com um ou mais itens. | Crítica | Implementado | Venda válida retorna `201` e identificador do pedido. |
| RF-VEN-002 | Cada item deve informar produto, quantidade positiva e variação quando aplicável. | Crítica | Implementado | Item incompleto, inexistente ou incompatível é recusado. |
| RF-VEN-003 | O sistema deve aceitar pagamento em Pix, débito, crédito ou dinheiro. | Crítica | Implementado | Valor fora dessas opções é recusado. |
| RF-VEN-004 | O sistema deve validar o estoque consolidado de itens repetidos antes de confirmar a venda. | Crítica | Implementado | Repetições são somadas e saldo insuficiente retorna conflito sem venda parcial. |
| RF-VEN-005 | O sistema deve calcular total bruto, desconto e total líquido no servidor. | Crítica | Implementado | Valores persistidos não dependem de totais enviados pelo navegador. |
| RF-VEN-006 | O sistema deve identificar associado cadastrado antes de aplicar o desconto. | Crítica | Implementado | Marcação isolada do frontend não concede desconto sem confirmação cadastral. |
| RF-VEN-007 | O sistema deve salvar nome e preço unitário de cada item como dados históricos. | Crítica | Implementado | Alterar ou excluir produto não muda venda anterior. |
| RF-VEN-008 | A confirmação da venda deve persistir cabeçalho, itens, baixa de estoque e movimentações. | Crítica | Implementado | Todos os registros são confirmados; em erro, ocorre rollback. |
| RF-VEN-009 | O sistema deve permitir venda vinculada a cliente ou atendimento de balcão. | Alta | Implementado | Cliente é opcional, exceto nas condições previstas para fechamento identificado. |
| RF-VEN-010 | O sistema deve registrar observação opcional junto à venda. | Baixa | Implementado | Texto informado é recuperado no histórico do pedido. |
| RF-VEN-011 | Falha ao persistir a venda deve retornar erro e não deixar transação parcial. | Crítica | Implementado | Banco permanece sem venda/baixa incompleta após exceção. |

### 4.8 Pedidos e exceções de pagamento

| ID | Requisito | Prioridade | Situação | Critério de aceite |
|---|---|---:|---|---|
| RF-PED-001 | Usuário autorizado deve listar pedidos por busca e situação. | Alta | Implementado | Filtros retornam somente pedidos compatíveis. |
| RF-PED-002 | Cada pedido deve apresentar número, cliente, pagamento, itens, totais, desconto, data e situação. | Alta | Implementado | A serialização contém os dados históricos completos. |
| RF-PED-003 | O operador deve poder registrar uma venda com exceção de pagamento. | Alta | Implementado | Pedido é criado com exceção ativa e estado pendente. |
| RF-PED-004 | A exceção de pagamento deve registrar prazo e observação opcional. | Alta | Implementado | Prazo válido é persistido e retornado no pedido. |
| RF-PED-005 | Usuário com permissão `orders` deve marcar exceção como paga ou retorná-la a pendente. | Alta | Implementado | Estado e data de quitação são atualizados de acordo com a ação. |
| RF-PED-006 | A listagem deve separar logicamente pedido concluído de exceção pendente. | Média | Implementado | Situação calculada corresponde ao estado da exceção. |

### 4.9 Dashboard, indicadores e notificações

| ID | Requisito | Prioridade | Situação | Critério de aceite |
|---|---|---:|---|---|
| RF-DSH-001 | Usuário com permissão adequada deve consultar receita, pedidos e itens por dia. | Alta | Implementado | Série retorna todos os dias do intervalo, inclusive dias zerados. |
| RF-DSH-002 | O intervalo diário deve aceitar de 1 a 90 dias. | Média | Implementado | Intervalo fora do limite é recusado. |
| RF-DSH-003 | O sistema deve apresentar vendas por hora no período operacional das 8h às 18h. | Média | Implementado | A série contém todas as horas do intervalo. |
| RF-DSH-004 | O sistema deve calcular métricas atuais e variação percentual em relação ao período anterior. | Alta | Implementado | Receita, pedidos e itens possuem valor e comparação. |
| RF-DSH-005 | O sistema deve listar produtos mais vendidos por quantidade e receita. | Alta | Implementado | Ranking é derivado dos itens de vendas persistidos. |
| RF-DSH-006 | Usuários autenticados devem receber notificações operacionais. | Média | Implementado | Endpoint retorna avisos de sistema, estoque, vendas e pagamentos. |
| RF-DSH-007 | O sistema deve alertar produtos ativos com saldo menor ou igual a cinco. | Alta | Implementado | Existindo baixo estoque, uma notificação é apresentada. |
| RF-DSH-008 | O sistema deve alertar exceções pendentes vencidas ou com vencimento em até dois dias. | Alta | Implementado | Até cinco exceções são ordenadas pelo prazo e classificadas corretamente. |

### 4.10 Relatórios

| ID | Requisito | Prioridade | Situação | Critério de aceite |
|---|---|---:|---|---|
| RF-REL-001 | Usuário com permissão `reports` deve exportar relatórios em CSV UTF-8. | Alta | Implementado | Download possui BOM, delimitador `;`, cabeçalho e nome descritivo. |
| RF-REL-002 | Relatórios temporais devem aceitar hoje, últimos 7, 30 ou 365 dias. | Alta | Implementado | `today`, `week`, `month` e `year` aplicam o intervalo esperado. |
| RF-REL-003 | O sistema deve exportar vendas detalhadas e resumo diário. | Alta | Implementado | Tipos `sales` e `daily` produzem colunas documentadas. |
| RF-REL-004 | O sistema deve exportar estoque atual, baixo, esgotado e valor em estoque. | Alta | Implementado | Tipos `stock`, `stock-low`, `stock-out` e `stock-value` refletem os saldos atuais. |
| RF-REL-005 | O sistema deve exportar desempenho de produtos para análise ABC. | Média | Implementado | Relatório contém produto, categoria, quantidade e receita. |
| RF-REL-006 | O sistema deve exportar clientes e consumo no período. | Média | Implementado | Relatório contém identificação, associação, pedidos e total gasto. |
| RF-REL-007 | O sistema deve exportar desempenho de categorias. | Média | Implementado | Relatório contém produtos ativos, itens vendidos e receita. |
| RF-REL-008 | Tipo de relatório desconhecido deve ser recusado. | Baixa | Implementado | A API retorna `404`. |

### 4.11 AAPM Smart, saúde e suporte

| ID | Requisito | Prioridade | Situação | Critério de aceite |
|---|---|---:|---|---|
| RF-SYS-001 | Usuário com permissão `smart` deve consultar insights baseados em vendas e estoque. | Média | Implementado | A resposta apresenta previsão, riscos, reposição e ações sugeridas. |
| RF-SYS-002 | O assistente deve responder perguntas operacionais usando o contexto calculado pelo sistema. | Média | Implementado | Mensagem não vazia produz resposta relacionada aos dados disponíveis. |
| RF-SYS-003 | O assistente deve fornecer resposta local de contingência quando o provedor externo não estiver disponível. | Alta | Implementado | Falha externa não impede uma orientação baseada nos insights locais. |
| RF-SYS-004 | Usuário com permissão `settings` deve consultar saúde do banco, SMTP e IA. | Média | Implementado | Endpoint informa estado e alertas sem expor segredos. |
| RF-SYS-005 | Usuário autenticado deve enviar solicitação de suporte com assunto e mensagem. | Média | Implementado | Mensagem válida é encaminhada por SMTP e retorna confirmação. |
| RF-SYS-006 | Mensagem vazia ao suporte ou assistente deve ser recusada. | Baixa | Implementado | A API retorna erro de validação. |

## 5. Regras de negócio

### 5.1 Identidade, acesso e segurança operacional

| ID | Regra |
|---|---|
| RN-AUT-001 | O e-mail do usuário é único e deve ser normalizado para letras minúsculas antes da persistência. |
| RN-AUT-002 | Senhas nunca podem ser persistidas em texto simples; somente o hash bcrypt é armazenado. |
| RN-AUT-003 | O JWT de sessão deve conter identificação, nome, perfil e permissões do usuário. |
| RN-AUT-004 | O tempo da sessão é definido por `ACCESS_TOKEN_EXPIRE_MINUTES`. |
| RN-AUT-005 | O token de recuperação possui finalidade exclusiva `password_reset` e validade de 30 minutos. |
| RN-AUT-006 | Usuário inativo não pode iniciar sessão, mesmo com senha correta. |
| RN-AUT-007 | Administrador possui acesso integral; demais usuários dependem das permissões atribuídas. |
| RN-AUT-008 | Somente administrador pode criar, editar ou alterar a situação de usuários. |
| RN-AUT-009 | A própria conta administrativa não pode ser desativada pelo fluxo de alternância de situação. |
| RN-AUT-010 | O JWT comprova a identidade, mas situação, perfil e permissões devem ser revalidados no banco a cada requisição protegida. |
| RN-AUT-011 | Token com finalidade `password_reset` não pode autenticar uma sessão de acesso. |

### 5.2 Catálogo

| ID | Regra |
|---|---|
| RN-CAT-001 | Nome de categoria é obrigatório e único sem diferenciação entre maiúsculas e minúsculas. |
| RN-CAT-002 | Categoria com produto ativo vinculado não pode ser desativada. |
| RN-CAT-003 | A remoção de categoria é lógica; produtos e histórico não são excluídos. |
| RN-PRD-001 | Nome de produto é obrigatório e não pode conflitar com outro produto na edição. |
| RN-PRD-002 | Preço e estoque de produto ou variação não podem ser negativos. |
| RN-PRD-003 | Categoria atribuída a produto deve existir e estar ativa. |
| RN-PRD-004 | Uma variação deve informar pelo menos tamanho ou cor. |
| RN-PRD-005 | A combinação tamanho/cor não pode se repetir no mesmo produto, desconsiderando capitalização. |
| RN-PRD-006 | Cada variação recebe código interno único no formato gerado pelo sistema. |
| RN-PRD-007 | Em produto com variações, o preço-base corresponde ao menor preço das variações. |
| RN-PRD-008 | Em produto com variações, o estoque-base corresponde à soma dos estoques das variações. |
| RN-PRD-009 | Produto já existente só pode ser complementado pelo fluxo de cadastro quando forem fornecidas novas variações. |
| RN-PRD-010 | Produto inativo não pode ser vendido nem receber edição pelo fluxo comum de edição. |
| RN-PRD-011 | Imagem reutilizada deve existir na biblioteca e possuir extensão permitida. |
| RN-PRD-012 | Ao substituir upload, a imagem anterior controlada pelo sistema deve ser removida quando aplicável. |
| RN-PRD-013 | Upload deve possuir extensão e assinatura binária compatíveis e respeitar `MAX_PRODUCT_IMAGE_BYTES`, cujo padrão é 5 MB. |

### 5.3 Clientes e desconto

| ID | Regra |
|---|---|
| RN-CLI-001 | Nome do cliente é obrigatório para cadastro. |
| RN-CLI-002 | Matrícula é opcional, mas deve ser única quando informada. |
| RN-CLI-003 | O associado é identificado por cadastro ativo com `is_associado = true`. |
| RN-CLI-004 | O desconto institucional de associado é de 10% sobre o total bruto. |
| RN-CLI-005 | O desconto só é aplicado após confirmação do associado pelo cadastro, independentemente da marcação enviada pelo frontend. |
| RN-CLI-006 | Venda de balcão pode existir sem cliente vinculado. |
| RN-CLI-007 | A exclusão do cliente não exclui suas vendas; a chave da venda torna-se nula. |

### 5.4 Venda, estoque e histórico

| ID | Regra |
|---|---|
| RN-VEN-001 | Uma venda deve possuir pelo menos um item com quantidade inteira maior que zero. |
| RN-VEN-002 | Formas de pagamento válidas são exclusivamente `pix`, `debito`, `credito` e `dinheiro`. |
| RN-VEN-003 | Produto vendido deve existir e estar disponível no catálogo; variação deve pertencer ao produto informado. |
| RN-VEN-004 | Produto que possui variações exige seleção de uma variação. |
| RN-VEN-005 | Quantidades repetidas do mesmo produto/variação são agregadas antes da validação de estoque. |
| RN-VEN-006 | O saldo nunca pode ficar negativo após uma venda ou ajuste. |
| RN-VEN-007 | O preço usado na venda é obtido do produto ou da variação no servidor. |
| RN-VEN-008 | Total bruto é a soma de `quantidade × preço unitário` de todos os itens. |
| RN-VEN-009 | Total líquido é o total bruto reduzido pelo percentual de desconto confirmado. |
| RN-VEN-010 | A venda deve guardar total bruto, total líquido, percentual e valor monetário do desconto. |
| RN-VEN-011 | Item de venda deve copiar nome e preço para formar um histórico imutável. |
| RN-VEN-012 | A exclusão de produto deve anular a referência em itens antigos sem apagar nome, preço, quantidade ou venda. |
| RN-VEN-013 | A exclusão de venda deve remover seus itens em cascata. |
| RN-VEN-014 | Venda, itens, atualização de saldo e movimentos devem compor uma única unidade transacional. |
| RN-EST-001 | Reposição de estoque aceita somente quantidade maior que zero. |
| RN-EST-002 | Reposição de produto com variações atualiza o saldo-base e o saldo da variação escolhida. |
| RN-EST-003 | Movimentação de entrada usa o preço corrente do produto ou variação. |
| RN-EST-004 | Movimentação deve identificar o usuário responsável; operação sem usuário resolvido é recusada. |
| RN-EST-005 | `entrada`/`adicionar` equivalem a entrada e `saida`/`retirar` equivalem a saída nos filtros. |

### 5.5 Exceções, indicadores e relatórios

| ID | Regra |
|---|---|
| RN-PED-001 | Exceção de pagamento ativa exige prazo válido. |
| RN-PED-002 | Nova exceção inicia com estado `pendente` e sem data de quitação. |
| RN-PED-003 | Ao marcar como paga, o estado passa a `pago` e a data de quitação recebe o horário local. |
| RN-PED-004 | Ao reabrir a exceção, o estado volta a `pendente` e a data de quitação é removida. |
| RN-PED-005 | Pedido sem exceção não pode receber atualização de quitação. |
| RN-DSH-001 | Horários e períodos operacionais usam por padrão `America/Sao_Paulo`, com fallback UTC−03:00. |
| RN-DSH-002 | Produto com estoque baixo possui saldo entre 1 e 5; produto esgotado possui saldo menor ou igual a zero. |
| RN-DSH-003 | Alerta de exceção é gerado quando o prazo já venceu ou ocorrerá em até dois dias. |
| RN-REL-001 | CSV deve usar ponto e vírgula para compatibilidade regional e BOM para identificação UTF-8. |
| RN-REL-002 | Período inválido de relatório assume os últimos 30 dias. |
| RN-REL-003 | Relatórios históricos usam valores persistidos nas vendas e itens, não o preço atual do catálogo. |
| RN-AI-001 | Sugestões da IA são informativas e não podem alterar estoque, vendas ou cadastros automaticamente. |
| RN-AI-002 | A indisponibilidade do provedor de IA não pode bloquear PDV, dashboard ou relatórios. |

## 6. Requisitos não funcionais

### 6.1 Segurança e privacidade

| ID | Requisito | Prioridade | Situação | Verificação |
|---|---|---:|---|---|
| RNF-SEG-001 | Credenciais e chaves devem ser fornecidas por variáveis de ambiente e não versionadas. | Crítica | Implementado | Revisão do repositório e configuração de implantação. |
| RNF-SEG-002 | Senhas devem usar hash bcrypt via Passlib. | Crítica | Implementado | Inspeção do hash e teste de autenticação. |
| RNF-SEG-003 | Cookie de sessão deve ser HttpOnly e `SameSite=Lax`. | Crítica | Implementado | Inspeção dos atributos `Set-Cookie`. |
| RNF-SEG-004 | Em produção, o cookie de sessão deve usar `Secure` e todo tráfego deve ocorrer por HTTPS. | Crítica | Implementado | `APP_ENV=production` ativa `Secure`; `COOKIE_SECURE` permite configuração explícita e o ambiente deve validar HTTPS. |
| RNF-SEG-005 | Toda mutação administrativa deve validar autorização no backend. | Crítica | Implementado | Testes de acesso direto sem permissão retornam `401` ou `403`. |
| RNF-SEG-006 | Respostas de saúde e erros não devem expor senhas, tokens, chaves ou strings completas de conexão. | Crítica | Implementado | Inspeção de payloads e logs. |
| RNF-SEG-007 | O sistema deve aplicar proteção CSRF adequada às operações autenticadas por cookie. | Crítica | Implementado | Mutações exigem correspondência entre cookie CSRF e cabeçalho ou campo de formulário. |
| RNF-SEG-008 | Upload deve impedir extensão não autorizada, conteúdo disfarçado, excesso de tamanho e nome de caminho arbitrário. | Alta | Implementado | Assinatura binária, extensão, limite e destino são validados antes da gravação. |
| RNF-SEG-009 | Dados pessoais devem ser acessíveis somente a usuários internos autorizados. | Crítica | Implementado | Rotas de clientes exigem autenticação e permissão correspondente. |
| RNF-SEG-010 | Logs não devem registrar senha, conteúdo de token ou segredo SMTP/IA. | Crítica | Requer validação | Revisão automatizada e operacional de logs. |

### 6.2 Confiabilidade e integridade

| ID | Requisito | Prioridade | Situação | Verificação |
|---|---|---:|---|---|
| RNF-CON-001 | Operações financeiras devem ser atômicas. | Crítica | Implementado | Testes de falha intermediária e concorrência confirmam rollback integral e impedem consumo duplicado do saldo. |
| RNF-CON-002 | O sistema deve preservar pedidos e itens quando cliente, produto ou variação forem removidos. | Crítica | Implementado | Teste de exclusão mantém o histórico consultável. |
| RNF-CON-003 | Chaves únicas e estrangeiras devem proteger e-mails, matrículas, categorias, atributos e códigos de variação. | Alta | Implementado | Inspeção do esquema e testes de conflito. |
| RNF-CON-004 | Sessões de banco devem ser encerradas ao final de cada requisição. | Alta | Implementado | Dependência `get_db()` fecha a sessão no bloco `finally`. |
| RNF-CON-005 | Conexões remotas devem verificar disponibilidade antes do uso e ser recicladas periodicamente. | Média | Implementado | Engine configurado com `pool_pre_ping` e `pool_recycle`. |
| RNF-CON-006 | Mudanças de esquema devem ser versionadas e reversíveis com Alembic. | Alta | Implementado | Toda mudança possui `upgrade` e `downgrade`, e a aplicação não executa DDL no startup. |
| RNF-CON-007 | A operação deve possuir política documentada de backup, restauração e teste periódico. | Crítica | Requer validação | Evidência de rotina, retenção e teste de restauração no ambiente alvo. |
| RNF-CON-008 | Falha de SMTP ou IA não deve comprometer transações de venda. | Alta | Implementado | Simulação de indisponibilidade mantém funções centrais operantes. |

### 6.3 Desempenho e capacidade

| ID | Requisito | Prioridade | Situação | Verificação |
|---|---|---:|---|---|
| RNF-DES-001 | Consultas paginadas/limitadas devem impor limites no servidor quando houver potencial de crescimento contínuo. | Alta | Parcial | Movimentações já limitam 1–200; produtos, clientes e pedidos ainda requerem avaliação de paginação. |
| RNF-DES-002 | O tempo-alvo de resposta para operações interativas deve ser definido após medição no ambiente real. | Alta | Requer validação | Baseline de p50, p95 e p99 documentada antes da homologação de produção. |
| RNF-DES-003 | A capacidade simultânea deve ser dimensionada conforme usuários e banco do ambiente institucional. | Alta | Requer validação | Teste de carga com volume e concorrência aprovados pelo responsável do produto. |
| RNF-DES-004 | Relatórios devem processar o período solicitado sem bloquear indefinidamente outras requisições. | Média | Requer validação | Teste com a massa máxima projetada e monitoramento de duração. |
| RNF-DES-005 | Recursos estáticos da interface devem ser servidos sem cache durante desenvolvimento e com política apropriada em produção. | Média | Parcial | `/apps` usa `no-store`; política de produção deve ser definida. |

Não são fixados números de latência ou concorrência sem medição do ambiente de implantação. Esses valores devem ser adicionados como critérios mensuráveis após o teste de capacidade, evitando compromissos arbitrários.

### 6.4 Usabilidade e acessibilidade

| ID | Requisito | Prioridade | Situação | Verificação |
|---|---|---:|---|---|
| RNF-USA-001 | A interface deve comunicar sucesso, erro, carregamento e ausência de dados em linguagem clara. | Alta | Implementado | Homologação dos principais fluxos e mensagens. |
| RNF-USA-002 | A navegação deve ocultar módulos não autorizados sem substituir a proteção do backend. | Alta | Implementado | Teste com diferentes conjuntos de permissões. |
| RNF-USA-003 | O PDV deve funcionar em resolução desktop institucional e adaptar-se a telas menores suportadas. | Alta | Requer validação | Matriz de resoluções e navegadores aprovada em homologação. |
| RNF-USA-004 | Controles essenciais devem ser utilizáveis por teclado e possuir foco visível. | Alta | Requer validação | Auditoria WCAG por teclado. |
| RNF-USA-005 | Textos, campos, botões e estados não devem depender exclusivamente de cor. | Média | Requer validação | Auditoria visual e com simuladores de visão de cores. |
| RNF-USA-006 | A interface deve usar português do Brasil e formatação local de moeda e data. | Média | Implementado | Valores aparecem em reais e datas em padrão brasileiro onde apresentados ao usuário. |

### 6.5 Manutenibilidade, compatibilidade e observabilidade

| ID | Requisito | Prioridade | Situação | Verificação |
|---|---|---:|---|---|
| RNF-MAN-001 | A API do domínio deve permanecer versionada sob `/api/v1/pdv` até introdução formal de nova versão. | Alta | Implementado | Inspeção das rotas publicadas. |
| RNF-MAN-002 | Modelos, migrations, API e frontend devem evoluir de forma compatível na mesma entrega. | Alta | Parcial | Checklist de revisão e testes de integração. |
| RNF-MAN-003 | Regras críticas de autenticação, venda, desconto, estoque e permissões devem possuir testes automatizados. | Crítica | Parcial | Suíte de testes executável cobre cenários positivos e negativos. |
| RNF-MAN-004 | Dependências devem ser declaradas em `requirements.txt` e ter versões controladas para produção. | Alta | Parcial | Todas as bibliotecas estão declaradas; parte delas ainda não possui versão fixada. |
| RNF-MAN-005 | A aplicação deve oferecer documentação OpenAPI dos endpoints. | Média | Implementado | `/docs` e `/redoc` são acessíveis no ambiente autorizado. |
| RNF-MAN-006 | Falhas relevantes devem gerar logs com contexto suficiente para diagnóstico, sem dados secretos. | Alta | Parcial | SMTP e suporte registram falhas; logging estruturado global ainda requer validação. |
| RNF-MAN-007 | O sistema deve expor diagnóstico de banco, SMTP e IA a usuário com permissão `settings`. | Média | Implementado | `/system/health` retorna estado dos componentes. |
| RNF-MAN-008 | A aplicação deve funcionar com o banco definido em `DATABASE_URL`, respeitando compatibilidade SQLAlchemy. | Alta | Implementado | Inicialização e migrations são testadas no banco escolhido para implantação. |
| RNF-MAN-009 | A implantação deve definir `AAPM_TIMEZONE`, usando `America/Sao_Paulo` como padrão. | Média | Implementado | Datas de vendas, relatórios e alertas seguem o timezone configurado. |

## 7. Requisitos de integração

| ID | Integração | Requisito | Contingência |
|---|---|---|---|
| INT-DB-001 | Banco SQLAlchemy | A aplicação deve obter a conexão por `DATABASE_URL`. | Falha deve impedir gravação e retornar erro sem transação parcial. |
| INT-SMTP-001 | SMTP | Recuperação de senha deve usar host, porta, remetente, autenticação e TLS/SSL configuráveis. | Retornar indisponibilidade sem revelar credenciais. |
| INT-SMTP-002 | SMTP | Solicitações de suporte devem ser encaminhadas ao destinatário configurado. | Retornar erro operacional e registrar causa sanitizada. |
| INT-IA-001 | IA externa | O Smart pode consultar provedor habilitado com credencial válida. | Usar resposta local de fallback. |
| INT-IA-002 | IA externa | A aplicação deve informar indisponibilidade/configuração no diagnóstico. | Demais módulos permanecem disponíveis. |
| INT-ARQ-001 | Armazenamento local | Uploads devem ser persistidos em `database/static/uploads` e publicados em `/static`. | Falha de gravação deve impedir associação inválida ao produto. |

## 8. Matriz de autorização da API

| Recurso | Regra de acesso |
|---|---|
| Categorias — leitura | Qualquer usuário autenticado |
| Categorias — escrita | `categories` ou administrador |
| Produtos — leitura administrativa | Uma das permissões consumidoras: produtos, estoque, dashboard, gráficos, relatórios ou Smart |
| Produtos — escrita e imagens | `products` ou administrador |
| Catálogo de venda e consulta de associado | Qualquer usuário autenticado |
| Registro de venda | Qualquer usuário autenticado |
| Estoque e movimentações | `stock`, `movements` ou `stock_movements`, ou administrador |
| Clientes | `customers`; leitura também aceita `reports` |
| Pedidos | `orders`, `dashboard`, `charts`, `reports` ou `smart`; alteração exige `orders` |
| Indicadores | Permissões compatíveis com dashboard, gráficos, relatórios ou Smart conforme endpoint |
| Smart | `smart` ou administrador |
| Relatórios | `reports` ou administrador |
| Saúde do sistema | `settings` ou administrador |
| Perfil, suporte e notificações | Qualquer usuário autenticado |
| Gestão de usuários | Exclusivamente administrador |

## 9. Matriz de rastreabilidade

| Domínio | Requisitos funcionais | Regras de negócio | Componentes principais |
|---|---|---|---|
| Autenticação | RF-AUT-001–012 | RN-AUT-001–011 | `database/auth.py`, `auth_controller.py` |
| Usuários | RF-USR-001–009 | RN-AUT-007–011 | `admin_controller.py`, `usuario.py` |
| Categorias | RF-CAT-001–005 | RN-CAT-001–003 | `api/v1/pvd.py`, `categoria.py` |
| Produtos e variações | RF-PRD-001–013 | RN-PRD-001–012 | `produto.py`, `variacao.py`, `produto_controller.py` |
| Estoque | RF-EST-001–008 | RN-EST-001–005 | `stock_service.py`, `movimentacao.py`, `api/v1/pvd.py` |
| Clientes | RF-CLI-001–007 | RN-CLI-001–007 | `cliente.py`, `api/v1/pvd.py` |
| Vendas | RF-VEN-001–011 | RN-VEN-001–014 | `sale_service.py`, `stock_service.py`, `venda.py`, `api/v1/pvd.py` |
| Pedidos | RF-PED-001–006 | RN-PED-001–005 | `venda.py`, `api/v1/pvd.py` |
| Dashboard | RF-DSH-001–008 | RN-DSH-001–003 | `dashboard.js`, `api/v1/pvd.py` |
| Relatórios | RF-REL-001–008 | RN-REL-001–003 | `report_service.py`, `api/v1/pvd.py` |
| Smart e sistema | RF-SYS-001–006 | RN-AI-001–002 | `ai_client.py`, `smtp_client.py`, `api/v1/pvd.py`, `auth_controller.py` |

## 10. Critérios de homologação

Uma versão somente pode ser considerada apta para operação quando:

1. todos os requisitos críticos aplicáveis tiverem testes positivos e negativos aprovados;
2. não houver possibilidade conhecida de venda com estoque negativo ou persistência parcial;
3. permissões forem testadas com administrador, operador e funcionário restrito;
4. desconto de associado for validado contra o cadastro real;
5. backup e restauração do banco do ambiente alvo forem comprovados;
6. segredos de produção estiverem fora do repositório e cookies seguros estiverem habilitados sob HTTPS;
7. migrations forem aplicadas em cópia representativa do banco e o rollback previsto estiver documentado;
8. SMTP, IA e seus modos de contingência forem verificados;
9. relatórios forem conciliados com uma amostra conhecida de vendas e estoque;
10. pendências marcadas como **Requer validação** forem aceitas formalmente ou resolvidas antes da entrada em produção.

## 11. Controle de mudanças

Qualquer mudança funcional deve:

1. citar os IDs afetados;
2. alterar ou incluir critérios de aceite;
3. atualizar modelos e migrations quando houver impacto de dados;
4. atualizar os contratos OpenAPI e o frontend consumidor;
5. incluir testes proporcionais ao risco;
6. registrar nova versão e data-base deste documento.

---

*Esta especificação representa o comportamento do AAPM observado em agosto de 2026 e os requisitos necessários para sua operação profissional. Itens “Parcial” ou “Requer validação” não devem ser interpretados como garantias já homologadas.*
