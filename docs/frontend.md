# Frontend e sistema visual

## Direção

Interface de trabalho inspirada na clareza de Stripe, Notion, Linear e Vercel: navegação lateral persistente, hierarquia discreta, superfícies com bordas, foco nos dados e ações primárias. Violeta é o destaque de marca; verde, amarelo e vermelho sinalizam estados reais. Não há landing page entre o usuário e sua gestão.

Inter é carregada do próprio pacote, sem dependência de CDN. Temas claro/escuro usam tokens CSS. A preferência visual é o único valor persistido em localStorage. Breakpoints recolhem navegação e empilham cards. Tabelas permitem rolagem interna em telas estreitas. Dialogs Radix gerenciam foco, Escape e overlay.

## Árvore de componentes

```text
QueryClientProvider
└── App (autorização visual, navegação, sessão, seleção de unidade)
    ├── Sidebar (workspace, módulos, assinatura, conta)
    ├── Topbar (breadcrumb, busca da tela, tema, notificações)
    ├── Main / estados loading-error-empty
    │   ├── Dashboard (lazy / Suspense)
    │   │   ├── Kpi
    │   │   ├── RevenueChart
    │   │   ├── BarberPerformance
    │   │   ├── AppointmentTable
    │   │   └── ServicesDonut
    │   ├── Agenda / detalhes / slots
    │   ├── Clientes / equipe / serviços
    │   ├── Financeiro / comissões / estoque
    │   ├── CRM / WhatsApp / relatórios
    │   └── Master / planos / configurações
    └── Dialogs de cadastro e ações
```

Os componentes de UI têm arquivos próprios: `Button`, `Card`, `Input`, `Dialog`. `Avatar`, `Badge`, `Field`, `Select` e `Kpi` são compartilhados. `Dashboard.tsx` é uma página separada e lazy, retirando o carregamento dos gráficos da entrada dos demais módulos. Sidebar, tabelas e as outras páginas ainda são composições dentro de `App.tsx`; a próxima refatoração é extrair esses módulos e formulários sem alterar o contrato.

## Dados e estado

`lib/data.ts` define o contrato e dois adapters: demonstração em memória e API REST. A troca para API só ocorre após login bem-sucedido. Falha do backend não substitui silenciosamente dados reais por exemplos. React Query controla consultas, cache e invalidação após mutações. Consultas independentes dos módulos são paralelas e somente rotas autorizadas pelo perfil/plano são solicitadas.

Access token fica em memória. Refresh fica em cookie HttpOnly. Renovações simultâneas compartilham uma promise para evitar reutilização concorrente de refresh. Ao recarregar, refresh e `/auth/me` recuperam a sessão. Logout limpa identidade/cache e volta à entrada.

React Hook Form + Zod valida o formulário de cadastro; validações do cliente melhoram feedback, mas o servidor repete as regras e tem a palavra final. Reservas consultam disponibilidade por serviço/barbeiro/data; preço não é enviado na confirmação. Operações mostram sucesso/erro e desabilitam gravação durante execução.

## Navegação por perfil

MASTER vê plataforma, empresas, planos e configurações. EMPRESA vê recursos do plano. BARBEIRO vê agenda, seus clientes e comissões. CLIENTE vê seu espaço, reservas e configurações. Não há seletor de cargos no painel, inclusive nas prévias. As áreas de acesso têm URLs próprias, login/cadastro em `AuthPage.tsx` e Google em `GoogleButton.tsx`. O servidor valida portal e perfil antes de emitir tokens; nenhum cargo é escolhido no cadastro público.

Seleção de unidade filtra equipe e agenda. O cadastro de unidades respeita os limites no backend. Clientes e caixa seguem compartilhados dentro do tenant nesta primeira versão; financeiro/estoque por unidade estão no roadmap.

## Estados e acessibilidade

Cards têm estados vazios; consultas têm feedback de carregamento e erro recuperável. Ícones de ação possuem labels, formulários usam labels e mensagens, filtros têm nomes, botões de período informam `aria-pressed`. O design evita depender só da cor para representar status.

Antes da comercialização, validar teclado completo, leitores de tela, contraste dos textos menores, zoom 200%, foco e tabelas com usuários reais. Alguns metadados compactos usam 10–12 px; a validação de acessibilidade pode exigir aumento. Não se declara uma auditoria WCAG concluída.

## Próximas extrações

`components/layout`, `components/appointments`, `features/clients`, `features/finance`, `features/master`, `hooks/use-session`, `hooks/use-tenant`, `lib/api-client`, rotas dedicadas com React Router e filtros/paginação de servidor. Extrair ports do adapter de demonstração evita que dados fictícios sejam empacotados na configuração de produção final.
