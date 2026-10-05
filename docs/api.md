# Contrato REST

Base: `/api`. JSON UTF-8. UUIDs são identificadores de registros, instantes usam ISO-8601 com offset, dinheiro usa centavos inteiros. Não envie `tenant_id`: a empresa vem da sessão. Datas de nascimento usam `YYYY-MM-DD`.

Autenticação: `Authorization: Bearer <accessToken>`. Refresh é cookie HttpOnly; enviar `credentials: include` no navegador. O login devolve usuário sanitizado, vínculos, empresa, plano e features. Nenhum hash de senha aparece na resposta.

## Autenticação e contas

| Método | Rota                     | Acesso                 | Descrição                                                   |
| ------ | ------------------------ | ---------------------- | ----------------------------------------------------------- |
| POST   | `/auth/login`            | Público, rate limitado | Slug + email + senha + portal (master/team/client)          |
| POST   | `/auth/register`         | Público, rate limitado | Cadastro exclusivamente CLIENTE, respeitando plano          |
| GET    | `/auth/me`               | Autenticado            | Recuperar identidade sanitizada e permissões                |
| POST   | `/auth/register-company` | Público, rate limitado | Provisionar gestor EMPRESA no START                         |
| GET    | `/auth/google/config`    | Público, rate limitado | Client ID público e nonce vinculado a cookie                |
| POST   | `/auth/google`           | Público, rate limitado | Verificar ID token Google e entrar/cadastrar cliente        |
| POST   | `/auth/google/link`      | Autenticado            | Vínculo explícito Google com o mesmo email                  |
| POST   | `/auth/refresh`          | Cookie de refresh      | Rotacionar sessão                                           |
| POST   | `/auth/logout`           | Cookie de refresh      | Revogar família e remover cookie                            |
| GET    | `/users`                 | EMPRESA                | Listar contas sanitizadas do tenant                         |
| POST   | `/users`                 | EMPRESA                | Criar gestor ou vincular conta a cliente/barbeiro existente |
| PATCH  | `/users/:id`             | EMPRESA                | Ativar/desativar conta; não permite desativar a própria     |
| PATCH  | `/profile`               | CLIENTE                | Atualizar perfil próprio e consentimento                    |

```json
{
  "slug": "studio-original",
  "email": "empresa@barberhub.local",
  "password": "SUA_SENHA",
  "portal": "team"
}
```

Cadastro público:

```json
{
  "slug": "studio-original",
  "name": "Pedro Almeida",
  "email": "pedro@exemplo.com",
  "phone": "11999999999",
  "password": "senha-de-12-caracteres-ou-mais",
  "whatsappConsent": false
}
```

Provisionar conta de barbeiro requer `role: "BARBEIRO"`, `barberId`, nome, email e senha mínima de 12 caracteres. Cliente requer `clientId`. O servidor valida tenant e vínculo disponível. Não permite criar MASTER.

## Catálogos

| Recurso              | GET                      | POST/PATCH | Campos de criação                                                               |
| -------------------- | ------------------------ | ---------- | ------------------------------------------------------------------------------- |
| `/services`          | EMPRESA/BARBEIRO/CLIENTE | EMPRESA    | name, description?, durationMinutes, priceCents, active?                        |
| `/clients`           | Escopo do perfil         | EMPRESA    | name, phone, email?, birthDate?, whatsappConsent?, active?                      |
| `/barbers`           | Escopo do perfil         | EMPRESA    | name, unitId, commissionPercent, goalCents?, email?, phone?, active?            |
| `/units`             | Usuários da empresa      | EMPRESA    | name, address?                                                                  |
| `/categories`        | EMPRESA conforme plano   | EMPRESA    | name, kind: FINANCIAL ou STOCK                                                  |
| `/suppliers`         | EMPRESA/estoque          | EMPRESA    | name, email?, phone?                                                            |
| `/financial/entries` | EMPRESA/financeiro       | EMPRESA    | description, type, amountCents, method, categoryId?, occurredAt?                |
| `/stock/products`    | EMPRESA/estoque          | EMPRESA    | name, sku, quantity?, minimum?, costCents, priceCents, categoryId?, supplierId? |

`PATCH /recurso/:id` recebe somente campos permitidos. Não há exclusão destrutiva de clientes, serviços ou barbeiros; use `active: false` para preservar o histórico. `quantity` de estoque não pode ser editado por PATCH: use movimentação. Listagens atuais retornam arrays limitados a 1.000 registros; a paginação uniforme é uma etapa de escala.

Saída financeira é `type: "EXPENSE"` com valor positivo. Métodos: PIX, DINHEIRO, CREDITO, DEBITO. `POST /stock/products/:id/movements` recebe `{ "delta": -2, "reason": "Venda no balcão" }`; GET da mesma rota traz o histórico. O servidor impede saldo negativo sob concorrência.

## Agenda

| Método   | Rota                                                               | Descrição                                                             |
| -------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| GET      | `/appointments?from=ISO&to=ISO`                                    | Reservas no escopo do usuário e período                               |
| GET      | `/appointments/slots?barberId=UUID&serviceId=UUID&date=YYYY-MM-DD` | Horários UTC disponíveis, gerados no fuso da empresa                  |
| POST     | `/appointments`                                                    | Criar reserva com duração/preço/percentual determinados pelo servidor |
| PATCH    | `/appointments/:id/reschedule`                                     | Reagendar, validando ambos os profissionais e a nova grade            |
| PATCH    | `/appointments/:id/status`                                         | Transição autorizada; finalização registra pagamento e comissão       |
| POST     | `/appointments/:id/review`                                         | Cliente avalia atendimento próprio finalizado                         |
| GET/POST | `/blocks`                                                          | Empresa consulta/cria bloqueios por profissional                      |
| DELETE   | `/blocks/:id`                                                      | Empresa remove bloqueio                                               |
| GET/POST | `/business-hours`                                                  | Empresa configura expediente por unidade e dia da semana              |

Payload de reserva e reagendamento:

```json
{
  "clientId": "UUID",
  "barberId": "UUID",
  "serviceId": "UUID",
  "startsAt": "2027-01-12T10:00:00-03:00"
}
```

Atualização de status:

```json
{ "status": "FINALIZADO", "method": "PIX" }
```

Avaliação: `{ "rating": 5, "comment": "Excelente atendimento." }`.

Bloqueio: `{ "barberId": "UUID", "startsAt": "2027-01-12T12:00:00-03:00", "endsAt": "2027-01-12T13:00:00-03:00", "reason": "Almoço" }`. O intervalo pode abranger vários dias para férias. Um bloqueio que conflita com atendimento existente é recusado; resolva as reservas primeiro.

Expediente: `{ "unitId": "UUID", "weekday": 2, "opensAt": "09:00", "closesAt": "19:00" }`. Dia 0 = domingo, 6 = sábado. Há um intervalo por dia/unidade; pausas e exceções usam bloqueios. Não existem expedientes atravessando a meia-noite nesta versão.

## Indicadores e relatórios

| Método | Rota                             | Acesso                                           |
| ------ | -------------------------------- | ------------------------------------------------ |
| GET    | `/dashboard?from=ISO&to=ISO`     | EMPRESA/BARBEIRO, feature dashboard              |
| GET    | `/commissions?from=ISO&to=ISO`   | EMPRESA/BARBEIRO, próprios dados quando barbeiro |
| GET    | `/financial/dre?from=ISO&to=ISO` | EMPRESA, feature financial_advanced              |
| GET    | `/crm?days=15                    | 30                                               | 60`                      | EMPRESA, feature crm |
| GET    | `/notifications`                 | EMPRESA, feature whatsapp                        |
| GET    | `/reports/:kind?format=pdf       | xlsx&from=ISO&to=ISO`                            | EMPRESA, feature reports |
| GET    | `/audit`                         | EMPRESA, últimas 100 ações do tenant             |
| GET    | `/company`                       | Dados da empresa da sessão e plano               |
| GET    | `/plans`                         | MASTER/EMPRESA, catálogo de plataforma           |

Tipos de relatório: `receita`, `clientes`, `barbeiros`, `servicos`, `comissoes`, `agendamentos`. Máximo 366 dias por solicitação; exportação síncrona limitada a 10.000 linhas. Excel usa tipos de célula reais; PDF é gerado no servidor com paginação. Demonstração visual local usa CSV de caixa e impressão da página em vez das exportações do servidor.

Dashboard devolve receita, ticket médio, clientes únicos atendidos, novos cadastros, agendamentos e séries de serviços/profissionais/períodos. Receita operacional vem dos atendimentos finalizados; fluxo de caixa inclui também entradas avulsas. DRE atual devolve `basis: "CASH"`; não substitui DRE fiscal por competência.

## Master

| Método | Rota                            | Descrição                                                        |
| ------ | ------------------------------- | ---------------------------------------------------------------- |
| GET    | `/master/metrics`               | Totais, MRR, ARR, churn, empresas ativas/canceladas/suspensas    |
| GET    | `/master/companies`             | Nome, plano, estado, equipe/clientes, acesso e vencimento        |
| POST   | `/master/companies`             | Provisionar tenant, empresa, administrador, unidade e expediente |
| PATCH  | `/master/companies/:id`         | Ativar/suspender/cancelar e/ou mudar plano                       |
| GET    | `/master/companies/:id/metrics` | Volumes e receita da empresa específica                          |

```json
{
  "name": "Barbearia Central",
  "slug": "barbearia-central",
  "planCode": "PRO",
  "admin": {
    "name": "Gestor",
    "email": "gestor@exemplo.com",
    "password": "senha-inicial-de-12-caracteres"
  }
}
```

Alteração: `{ "status": "SUSPENDED" }` ou `{ "planCode": "PREMIUM" }`. Slug único; provisionamento é transacional. Downgrade com consumo superior ao limite retorna 403.

## Arquivos e operação

POST `/uploads`: multipart/form-data, campo `file`, até 5 MB, assinatura PNG/JPEG/PDF. A resposta traz id e URL privada. GET `/uploads/:id` exige sessão e autorização; arquivos não são servidos publicamente. Nome original não é utilizado na localização física.

GET `/health`: verificação operacional. Swagger é opcional com `ENABLE_SWAGGER=true`; desative ou restrinja no ingresso de produção. O documento automático lista rotas; os DTOs Zod e exemplos desta documentação são o contrato de campos da versão.

## Respostas de erro

```json
{ "statusCode": 409, "message": "Esse horário está ocupado. Escolha outro.", "requestId": "UUID" }
```

400 = validação; 401 = sessão inválida; 403 = perfil/plano/estado sem autorização; 404 = registro fora do tenant ou inexistente; 409 = conflito/duplicidade; 429 = limite de requisições; 503 = proteção de acesso indisponível. Não retornar detalhes SQL, senha, token ou dados de outra empresa.
