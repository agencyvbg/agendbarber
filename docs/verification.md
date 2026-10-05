# Evidências de verificação

Execução em 4 de outubro de 2026. Evidências descrevem somente os checks realmente feitos; não há alegação de auditoria de produção.

## Confirmado

- Compilação TypeScript do frontend e do backend.
- Validação do schema Prisma e geração do Prisma Client 6.19.
- Build da interface com Vite/Rollup, Tailwind e React.
- Duas migrações aplicadas em PostgreSQL 16.14 real, criado para QA local.
- Seed executado com senha fornecida por variável de ambiente.
- **24 testes: 5 de domínio e 19 de integração, todos passando**, sem testes pulados na execução integrada.

## Testes de domínio

Transições por perfil e estados terminais; intervalos adjacentes e sobrepostos; centavos e arredondamento; escopos sem vínculo falham fechados; limites e features dos planos.

## Testes no PostgreSQL com papel runtime

1. Consulta sem contexto retorna zero clientes; tenants A e B não veem clientes um do outro.
2. FK composta rejeita cliente de outro tenant no agendamento.
3. Duas reservas simultâneas do mesmo horário resultam em uma aceitação.
4. Duas finalizações geram um pagamento, um lançamento e uma comissão, preservando o percentual original.
5. Horários adjacentes são permitidos; horário bloqueado é recusado e removido dos slots.
6. Cliente não cancela reserva de outro cliente; lista do barbeiro respeita histórico.
7. Duas saídas concorrentes da última unidade de estoque não geram saldo negativo.
8. Criações concorrentes respeitam dois barbeiros no START; estoque é negado ao START.
9. Reuso de refresh revoga também a sessão descendente.
10. Cadastro público cria apenas CLIENTE no tenant resolvido; telefone duplicado reverte a conta criada na mesma transação.
11. Campanhas de aniversário e reativação criam um evento por ocorrência mesmo com processamento repetido.
12. Os seis tipos de relatório geram PDF válido e Excel aberto pela biblioteca; a exportação de clientes não contém o cliente de outro tenant.
13. Um perfil CLIENTE sem vínculo falha fechado na consulta de cadastro.
14. Login recusa área de outro perfil; `/auth/me` mantém identidade sanitizada e o cargo persistido.
15. Google não vincula conta existente implicitamente; vínculo exige mesmo email e não eleva o perfil.
16. Cadastro Google cria somente CLIENTE no tenant escolhido, sem cruzar outra empresa.
17. Logout revoga a família de refresh e impede recuperação por esse token.
18. Cadastro público de empresa provisiona START/EMPRESA, rejeita cargo/plano enviados e usa cookie HttpOnly.
19. Churn conta cada empresa da coorte inicial uma única vez, mesmo com cancelamento/reativação repetidos no mês.

## Navegador

A prévia foi inspecionada no Browser do aplicativo: dashboard, navegação, formulário de cliente e geração de horários futuros. Um cadastro de cliente foi salvo e incrementou a listagem de 24 para 25. Também foram concluídos uma reserva para o dia seguinte e seu cancelamento pela interface. A seleção de data recebeu um ajuste de input. A revisão em viewport de 390 × 844 identificou e corrigiu transbordamento da agenda; a largura da página ficou dentro do viewport.

Capturas da interface em [dashboard.jpg](dashboard.jpg) e [mobile.jpg](mobile.jpg). Os testes visuais não substituem um teste end-to-end de todo o backend nem uma auditoria de acessibilidade.

## Revisão de autenticação

Compilação frontend/backend e migração Google confirmadas. As 24 verificações acima executaram no PostgreSQL QA com papel restrito. Cadastro de empresa foi exercitado pelo controller e casos de uso; regras Google receberam identidades verificadas simuladas no limite dos casos de uso. A chamada de verificação de assinatura com um token real Google e o conjunto HTTP/Redis permanecem sem homologação. No navegador foram inspecionadas as áreas, formulários de cadastro de empresa/cliente, ausência de seletor de cargos no painel, diálogo de conta, saída da prévia e entrada mobile a 390 × 844.

## Limites da execução

Na revisão da sidebar foram verificadas abertura e fechamento em viewport 390 × 600, rolagem até a conta do rodapé, fechamento ao abrir o diálogo de perfis, troca para a visão Master e abertura do formulário de login. Também foi verificada rolagem própria em desktop de 1280 × 600. Captura em [sidebar-mobile.jpg](sidebar-mobile.jpg). O login HTTP não foi homologado nesta revisão.

O ambiente Windows restringe subprocessos iniciados por Node. A compilação de interface foi executada por uma configuração de QA equivalente em Vite/Rollup, com transpile TypeScript em processo e sem minificação, evitando o subprocesso esbuild. A configuração padrão Vite permanece no projeto para execução normal; a stack Docker ainda precisa ser compilada e homologada em seu ambiente de destino.

Docker não esteve acessível. Redis/BullMQ, Loki/Alloy/Grafana, API HTTP com rate limit Redis, envio real de WhatsApp, uploads via HTTP e downloads PDF/Excel via navegador não foram homologados como conjunto. A geração dos relatórios foi testada diretamente nos casos de uso; seu transporte HTTP e os adapters de mensagens precisam de homologação com as dependências externas.

Não foram realizados pentest, benchmark, teste de restauração, aprovação de templates, cobrança de gateway ou validação comercial/fiscal. Esses itens estão explicitamente no roadmap.
