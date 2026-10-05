# BarberHub

SaaS para gestão de barbearias, com frontend React/Vite e API NestJS/PostgreSQL.

**Entrega: MVP técnico executável, interface navegável e especificação de evolução comercial.** Não equivale a um lançamento Enterprise homologado. Cobrança recorrente, recuperação de senha, integrações externas e requisitos operacionais de produção precisam da etapa de homologação descrita no roadmap.

## Os dez entregáveis

| Entregável               | Onde encontrar                                                                    |
| ------------------------ | --------------------------------------------------------------------------------- |
| 1. Arquitetura           | [Arquitetura e decisões](docs/architecture.md)                                    |
| 2. Estrutura de pastas   | [Estrutura](docs/architecture.md#estrutura-de-pastas)                             |
| 3. Banco Prisma          | [Schema](apps/api/prisma/schema.prisma) e [migrações](apps/api/prisma/migrations) |
| 4. API REST              | [Contrato REST](docs/api.md) e Swagger opcional `/api/docs`                       |
| 5. Fluxos de negócio     | [Fluxos](docs/business-flows.md)                                                  |
| 6. Wireframes            | [Wireframes](docs/wireframes.md) e interface React executável                     |
| 7. Componentização React | [Frontend](docs/frontend.md), componentes e página Dashboard                      |
| 8. Permissões            | [Segurança e permissões](docs/security.md)                                        |
| 9. Escalabilidade        | [Plano de escala e operação](docs/scalability.md)                                 |
| 10. Roadmap              | [MVP → Enterprise](docs/roadmap.md)                                               |

## Stack

React 19, TypeScript, Vite 6, Tailwind 4, componentes Shadcn/UI customizados sobre Radix, React Query, React Hook Form e Zod. API Node.js/NestJS 11, Prisma 6.19, JWT, refresh token rotativo, PostgreSQL 16, Redis, BullMQ, upload privado, logs JSON/Pino e perfil de observabilidade Loki/Alloy/Grafana. Versões efetivas estão no `package-lock.json`.

## Executar a demonstração visual

Pré-requisito: Node.js 22+ e npm.

```sh
npm ci
npm run dev
```

Acesse `http://localhost:5173`. A demonstração usa dados fictícios em memória. Alterações desaparecem ao recarregar; somente a preferência de tema é salva no navegador. Nenhum dado de empresa, token ou senha é gravado em localStorage.

A entrada abre com login e cadastro. Há áreas separadas: `/master` para o proprietário da plataforma, `/app` para gestor/equipe e `/cliente` para clientes. O cargo vem da conta no servidor; não há seletor de cargos no painel. Cadastro por email cria uma nova empresa com gestor START ou um cliente da barbearia. Google pode ser habilitado com `GOOGLE_CLIENT_ID`. Consulte [Acesso e autenticação](docs/authentication.md). As prévias com dados fictícios são opções explícitas na entrada.

Em telas até 980 px a sidebar abre pelo botão de menu e fecha pelo X, pelo fundo, ao navegar ou com Escape. Ela possui rolagem própria em telas de pouca altura, bloqueio da página ao abrir no celular e navegação por teclado. Acesso à conta e saída continuam alcançáveis no rodapé.

## Executar a stack persistente com Docker

1. Copie `.env.example` para `.env`.
2. Substitua as senhas do PostgreSQL, Redis, senha inicial e segredo JWT. Use caracteres alfanuméricos/base64url nas senhas incorporadas às URLs ou faça o percent-encoding dos caracteres reservados.
3. Execute:

```sh
docker compose up -d --build
docker compose run --rm migrate node node_modules/tsx/dist/cli.mjs apps/api/prisma/seed.ts
```

A migração usa o proprietário do banco. A API usa `barberhub_app`, sem superuser e sem BYPASSRLS. O frontend fica em `http://localhost:8080`; a API em `http://localhost:3000/api`. O Redis é obrigatório para o rate limit: falhas da proteção retornam 503, sem permitir acesso irrestrito.

O seed cria duas empresas distintas e contas para teste, com a senha definida em `SEED_PASSWORD`:

| Slug                | Email                       | Perfil                     |
| ------------------- | --------------------------- | -------------------------- |
| `master`            | `master@barberhub.local`    | MASTER                     |
| `studio-original`   | `empresa@barberhub.local`   | EMPRESA                    |
| `studio-original`   | `barbeiro1@barberhub.local` | BARBEIRO                   |
| `studio-original`   | `cliente@barberhub.local`   | CLIENTE                    |
| `barbearia-central` | `empresa@barberhub.local`   | EMPRESA da segunda empresa |

Abra sua área de acesso e informe slug, email e senha (Master usa slug fixo `master`). Depois de entrar, a interface passa a ler e gravar na API. **Sair da conta** retorna ao login. O seed é uma ferramenta de desenvolvimento; não use as contas de exemplo em produção. Não imprime nem contém senha fixa.

## Executar API local com banco e Redis em Docker

```sh
docker compose up -d postgres redis
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev
```

Os comandos de migração e seed carregam o `.env` da raiz e usam `MIGRATION_DATABASE_URL`. A API carrega `DATABASE_URL`, correspondente ao papel restrito. O diretório de upload local é configurado por `UPLOAD_DIR`.

## Verificações

```sh
npm run build
npm test
```

Os testes de domínio sempre executam. Os testes de integração precisam de `TEST_DATABASE_URL` apontando para um **banco descartável já migrado**, com o usuário restrito `barberhub_app`. Criam empresas QA e removem seus registros ao concluir; conservam auditoria no banco descartável. Nunca aponte esse teste para produção.

```powershell
$env:TEST_DATABASE_URL = 'postgresql://barberhub_app:SENHA@localhost:5432/barberhub_test'
npm test
```

Evidências desta entrega estão em [Verificação](docs/verification.md). Docker, Redis, credenciais de WhatsApp e cobrança não foram homologados como conjunto nesta sessão.

## O que funciona

- Dashboard da empresa, agenda com geração de horários e bloqueios, clientes, barbeiros e serviços.
- Reserva e reagendamento com validação de expediente, profissional, cliente e colisões.
- Ciclo de atendimento e finalização transacional: pagamento, lançamento e comissão idempotentes.
- Gestão Master com provisionamento isolado, ativação/suspensão, mudança de plano e métricas.
- Fluxo de caixa, demonstrativo gerencial em regime de caixa, estoque, movimentações e CRM.
- Relatórios autenticados PDF/Excel dos seis tipos, por período.
- Contas de equipe, cadastro público de cliente pela API, perfil do cliente e avaliações.
- Isolamento por tenant, FKs compostas, RLS, RBAC, refresh rotativo, rate limit distribuído e auditoria.
- Outbox e workers para confirmação, lembretes 24h/2h, aniversário e reativação 15/30/60 dias.
- Adaptadores Evolution API e WhatsApp Business configuráveis, sem envio habilitado por padrão.
- Upload privado PNG/JPEG/PDF até 5 MB, com validação de assinatura e autorização no download.

## Limites atuais e etapa comercial

O financeiro entrega controle gerencial de caixa, não contabilidade fiscal por competência. Não há checkout/cobrança recorrente real, conciliação bancária ou estorno. MRR/ARR usam o preço dos planos de empresas ativas; contratos Enterprise de preço variável precisam de uma tabela de contratos de assinatura antes de entrar no cálculo.

Cadastros podem ser alterados pela API; algumas telas priorizam criação e consulta. O cadastro público de clientes e gestores possui formulário dedicado. Atualização completa de perfil e provisionamento de contas da equipe são APIs funcionais; seus formulários completos seguem no roadmap. Listagens operacionais são limitadas a 1.000 registros e relatórios a 10.000; substituir por paginação e exportação assíncrona antes de grandes volumes. A seleção de unidade filtra a agenda e equipe; clientes, estoque e financeiro ainda são compartilhados dentro da empresa.

As permissões do servidor são obrigatórias. A demonstração visual oferece todos os recursos para avaliação, independentemente de plano; em sessão autenticada, a navegação considera os recursos contratados.

Para lançar comercialmente, execute a homologação descrita em [Roadmap](docs/roadmap.md): teste integrado com Redis/Docker, políticas de cobrança, backups/restauração, monitoramento, TLS, acessibilidade e carga. O perfil de logs centralizados é iniciado com `docker compose --profile observability up -d`.
