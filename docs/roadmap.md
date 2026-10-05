# Roadmap do MVP ao Enterprise

Estimativas abaixo são planejamento para uma equipe pequena com desenvolvimento, produto/design e QA. Não são compromissos de prazo; validar carga e integrações muda o esforço.

## Estado entregue

| Área                               | Implementação                                                 | Pendência para lançamento                                                            |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Agenda/serviços/clientes/barbeiros | Interface, API, constraints, expediente e bloqueios           | Paginação, edição completa na UI e horários recorrentes sofisticados                 |
| Quatro perfis                      | Áreas de acesso, login/cadastro, logout e Google configurável | Onboarding da equipe, recuperação de senha, verificação de email, homologação Google |
| Multi-tenant                       | Contexto, FKs compostas e RLS com runtime restrito            | Revisão de segurança, carga com múltiplas réplicas e operação de produção            |
| Planos                             | Catálogo, limites, features e troca manual pelo Master        | Billing, checkout, webhooks e contratos Enterprise                                   |
| Master                             | Provisionamento, status, plano, métricas e listagem           | Busca/paginação e tela detalhada de métricas individuais                             |
| Financeiro/comissão                | Caixa, recebimento, snapshots e finalização idempotente       | Estornos, conciliação, baixa de comissão, DRE por competência                        |
| Estoque                            | Produtos, categoria/fornecedor via API, movimentos e mínimo   | Compras, venda integrada, estoque por unidade, inventário                            |
| CRM                                | Ativos/inativos, aniversariantes, marcos sem retorno          | Segmentação, campanhas gerenciadas e acompanhamento de conversão                     |
| WhatsApp                           | Outbox, BullMQ, cinco tipos de mensagens e dois adaptadores   | Credenciais, templates aprovados, teste do provedor e gestão de opt-out              |
| Relatórios                         | Seis PDFs/XLSX autenticados por período                       | Exportação assíncrona, filtros e volume grande                                       |
| Upload/logs                        | Upload privado, Pino e perfil Loki/Alloy/Grafana              | S3, malware, retenção, rotação e alertas validados                                   |
| UX/UI                              | Claro/escuro, componentes, mobile e formulários               | Auditoria de acessibilidade e testes com usuários                                    |

## Fase 1 — MVP piloto: 4–6 semanas após esta base

Objetivo: operar uma barbearia piloto de ponta a ponta, com dados persistentes e suporte próximo.

- Formulários de cadastro público, perfil completo e contas da equipe.
- Recuperação de senha com token de uso único; verificação de email e política de sessão.
- Extrair páginas/formulários de `App.tsx`; rotas e paginação de servidor.
- Revisar todos os fluxos START e PRO, incluindo erro de plano e limite.
- Teste integrado Docker + Redis + PostgreSQL + API + browser.
- Operação real de caixa, cancelamento e rastreabilidade, sem dados de seed.
- Homologação mobile/teclado/contraste; backup e restauração demonstrados.

Critério de saída: empresa piloto agenda e finaliza atendimento sem assistência de desenvolvedor; empresa A nunca obtém dados da B em testes HTTP e SQL; monitoramento detecta uma falha simulada; restauração recupera um ambiente consistente.

## Fase 2 — SaaS comercial: 4–8 semanas

Objetivo: vender START e PRO com assinatura, cobrança e suporte sustentável.

- Provedor de cobrança: checkout, assinatura, webhooks assinados/idempotentes, reconciliação.
- Estados de assinatura distintos do status de acesso: trial/active/past_due/cancelled, carência e políticas de retomada.
- Histórico de preço, contratos e descontos; MRR por assinatura contratada, ARR e churn por coorte.
- Integração real de WhatsApp e templates por evento, resultados e opt-out.
- Exportação assíncrona, gestão de falhas e reprocessamento.
- Backups gerenciados, alertas, testes de carga, dependências e revisão de segurança.
- Termos, privacidade e procedimentos de retenção/exclusão alinhados à operação.

Critério de saída: cobrança e suspensão reconciliadas com gateway; falhas de webhook não duplicam cobrança nem alteram plano indevidamente; empresa pode obter seus dados; suporte possui runbooks.

## Fase 3 — Premium operacional: 6–10 semanas

Objetivo: controlar até três unidades com gestão financeira e relacionamento mais completos.

- Unidade em pagamentos, financeiro, estoque e metas; relatórios por unidade e consolidados.
- Metas por profissional/unidade com período e histórico.
- Financeiro avançado: contas a pagar/receber, estorno, conciliação, categorias e competência.
- Venda de produtos integrada, compras/fornecedores e inventário.
- CRM segmentado, campanhas, conversão e consentimento auditável.
- Dashboard executivo com séries e comparações no servidor.

Critério de saída: indicadores reconciliam com lançamentos, multiunidade funciona sem misturar saldos de estoque e há rastreabilidade de movimentações.

## Fase 4 — Enterprise: 8–16 semanas ou conforme contrato

Objetivo: operação contratual de grandes redes, white label e integrações.

- White label: domínio, identidade visual, email e templates por contrato.
- API pública versionada, chaves por tenant com scopes/rotação, webhooks externos assinados.
- SSO/SAML/OIDC e MFA, gestão granular de permissões e auditoria exportável.
- Política de sessão, limites negociados e contratos/preço Enterprise.
- SLO/SLA, RTO/RPO, observabilidade e runbooks demonstrados sob carga.
- Migração/importação em lote, exportação assíncrona e eventual banco dedicado.
- Controle de regiões, retenção e requisitos de segurança pactuados com o cliente.

Critério de saída: todos os requisitos contratuais são mensuráveis e testados. A presença da feature `sla` ou `white_label` no catálogo não implementa, por si só, essas capacidades.

## Priorização de produto

Prioridade alta: confiança na agenda, isolamento, pagamentos internos sem duplicidade e experiência de cliente. Depois: cobrança, suporte e confiabilidade de mensagens. Crescimento: CRM/retorno e multiunidade. Enterprise: contratos e operação previsível.

Acompanhar ativação da empresa (primeiro serviço/equipe/cliente/reserva), ocupação, faltas, retorno, uso por perfil, receita reconciliada, MRR contratado e churn. Dados de demonstração e mudanças manuais de plano não devem ser apresentados como receita financeira liquidada.
