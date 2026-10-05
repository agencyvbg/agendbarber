# Wireframes e jornadas

Os desenhos abaixo representam hierarquia e ações. A interface React entregue é o protótipo navegável de alta fidelidade correspondente. Tema claro e escuro usam a mesma estrutura.

## Empresa: visão geral

```text
┌────────────────────┬─────────────────────────────────────────────────────┐
│ BarberHub          │ Workspace > Visão geral     Busca  Tema  Avisos Conta│
│ Empresa / unidade  ├─────────────────────────────────────────────────────┤
│                    │ Visão geral                    Exportar  +Agendar   │
│ Visão geral        │ Hoje | Semana | Mês                   Período        │
│ Agenda             │ ┌Receita─┐ ┌Clientes─┐ ┌Novos─┐ ┌Ticket médio─────┐ │
│ Clientes           │ └────────┘ └─────────┘ └──────┘ └─────────────────┘ │
│ Barbeiros          │ ┌Receita ao longo do período──┐ ┌Equipe───────────┐ │
│ Serviços           │ │ Gráfico e total             │ │ Receita e metas │ │
│ Financeiro         │ └─────────────────────────────┘ └─────────────────┘ │
│ Comissões          │ ┌Agenda de hoje───────────────┐ ┌Serviços─────────┐ │
│ Estoque            │ │Cliente Serviço Hora Status  │ │ Distribuição    │ │
│ CRM / WhatsApp     │ │Detalhes / iniciar / concluir│ │ e participação  │ │
│ Relatórios         │ └─────────────────────────────┘ └─────────────────┘ │
│ Plano / Config.    │                                                     │
│ Ajuda / Conta      │                                                     │
└────────────────────┴─────────────────────────────────────────────────────┘
```

## Agenda e reserva

```text
AGENDA
[Anterior] [Data] [Próximo] [Hoje]   [Profissional] [Status] [Bloquear]
[Resumo: reservas · horas ocupadas · valor em serviços]
[Cliente | Serviço | Profissional | Hora | Estado | Valor | Detalhes]

DIALOG: NOVO AGENDAMENTO
Cliente                [selecionar]       (cliente final já vinculado)
Serviço                [nome / duração / preço]
Profissional  [selecionar]   Data [selecionar]
Horários disponíveis   [09:00] [09:15] [09:30] ...
                       [Cancelar] [Confirmar agendamento]

DIALOG: ATENDIMENTO
Cliente / serviço / profissional / intervalo / estado / preço
[Confirmar] → [Iniciar] → [Pagamento] → [Finalizar]
[Reagendar] [Cancelar] [Não compareceu] conforme estado e permissão
```

## Master

```text
[Plataforma]                        [Nova empresa]
[Empresas ativas] [MRR] [ARR] [Canceladas]
[Equipe total] [Clientes totais] [Suspensas] [Total de empresas]
[Agendamentos] [Churn] [Assinaturas canceladas]

Empresa | Plano (alterar) | Estado | Equipe/Clientes | Acesso | Vencimento
Studio A | Premium        | Ativa  | 3 / 240        | Hoje   | 20/10
                                           [Suspender / Ativar]

Novo tenant: nome, slug, plano, nome/email/senha do administrador.
Métricas individuais: endpoint administrativo por empresa.
```

## Barbeiro

```text
[Minha visão]               [Novo agendamento permitido no meu escopo]
[Meta do mês] [Comissão no período]
[Receita própria] [Clientes atendidos] [Ticket médio]
[Minha agenda] → [Detalhes] → [Iniciar / Finalizar]
[Meus clientes]    [Comissões do dia / semana / mês]
```

## Cliente

```text
[Meu espaço]
[Próximo atendimento: serviço / profissional / data / hora]
[Agendar horário]
[Minhas reservas: confirmar dados / reagendar / cancelar]
[Histórico finalizado: avaliar de 1 a 5 estrelas]
[Perfil: nome, telefone, email, nascimento, consentimento]
```

## Financeiro, estoque e CRM

Financeiro: cards entradas/saídas/saldo; lista de lançamentos; novo lançamento com tipo/método/valor; demonstrativo de caixa. Estoque: produtos/saldo mínimo/custo; lista com alerta; movimentação com delta e motivo. CRM: ativos/sem retorno/aniversariantes; filtro 15/30/60 dias; convite para novo agendamento.

## Mobile

```text
┌─────────────────────────┐
│ Menu   Página  Tema Avis│
│ Título       +Agendar   │
│ Hoje | Semana | Mês     │
│ KPI 1       KPI 2       │
│ KPI 3       KPI 4       │
│ Gráfico                 │
│ Equipe                  │
│ Agenda (scroll interno) │
│ Serviços                │
└─────────────────────────┘
```

Menu lateral vira painel recolhível; cards empilham; detalhes usam dialog com altura limitada e rolagem. Não esconder ações de negócio essenciais no mobile. O protótipo dá feedback de estado vazio, erro de conflito, validação e sucesso.
