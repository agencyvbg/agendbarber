# Escalabilidade e operação

## Estágio inicial

Monólito modular em contêiner, SPA em CDN, PostgreSQL gerenciado com backups, Redis separado e worker. Escalar horizontalmente a API preservando JWT e rate limit compartilhado. A unidade de trabalho localiza o contexto por transação; sticky session não é necessária.

Não há metas de capacidade certificadas. Os números abaixo são cenários de planejamento e devem ser aferidos por carga real, tamanho de dados e perfil de uso.

| Cenário                     | Estratégia                                                   | Validação necessária                                           |
| --------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| Piloto, dezenas de empresas | API + worker + Postgres/Redis separados                      | Jornada completa, backup/restauração e alertas                 |
| Centenas de empresas        | Réplicas de API, pool controlado, paginação e índices        | p95, conexão DB, conflitos de agenda, filas e exportação       |
| Milhares de empresas        | Jobs/exportações separados, cache tenant-aware, agregações   | Isolamento sob carga, consumidores, limites e tenants maiores  |
| Enterprise                  | SLO/SLA, contratos, observabilidade, eventual banco dedicado | RTO/RPO, restauração seletiva, região e requisitos contratuais |

## Evolução técnica

1. Tornar listagens paginadas e filtradas no servidor, com cursor estável. O limite atual de 1.000 registros evita respostas sem limite, mas não substitui paginação.
2. Exportação assíncrona por job para grandes períodos. Armazenar resultado privado, com expiração e download autorizado. A exportação síncrona atual tem limite de 10.000 linhas.
3. Índices compostos começam por tenant e incluem profissional/cliente/data para agenda. Observar EXPLAIN ANALYZE em consultas reais; não adicionar índices sem medir escrita e uso.
4. Pool de conexões calculado pelo máximo do PostgreSQL dividido entre réplicas de API/worker. Configurar `connection_limit` na URL Prisma e considerar PgBouncer em modo transação.
5. Redis: namespaces separados para rate limit, filas e cache. Nunca chavear dados de empresa apenas por id de recurso ou URL; incluir tenant.
6. Worker separado da API para deploy e escala independentes. Hoje o worker é um provider Nest; executar em processo próprio é a próxima extração.
7. Upload: trocar volume por S3/serviço compatível e URLs assinadas curtas. Chave inclui tenant; metadata e autorização permanecem no banco. Adicionar varredura de malware e políticas de retenção.
8. Agregações de métricas por tenant/unidade/dia. Atualizar por eventos/outbox após commit. Preservar a possibilidade de reconciliar com lançamentos originais.
9. Particionar tabelas de auditoria/notificação/agenda somente depois de validar consultas, retenção e constraints de exclusão.
10. Tenants muito grandes podem ser roteados para banco dedicado. O contrato de aplicação precisa manter a mesma autorização e semântica transacional.

## Concorrência

Locks PostgreSQL serializam criação por limite do plano, reservas por profissional e saldo por produto. FKs compostas rejeitam relacionamentos cruzados. Constraint GiST mantém exclusão de intervalos e triggers coordenam reservas/bloqueios. Pagamento/comissão/lançamento únicos fornecem idempotência de finalização.

Ao distribuir módulos, manter agenda/finalização no mesmo banco enquanto possível. Se separar faturamento, usar outbox, idempotência por evento, reconciliação e estado explícito de pendência; não prometer commit atômico entre bancos e gateways.

## Deploy e segurança operacional

- Migrar em job anterior à API, com papel proprietário distinto do runtime.
- Não executar `db push` em produção: ele não instala as políticas SQL complementares.
- Ingresso HTTPS; `NODE_ENV=production`, origens reais, cookies Secure e proxy confiável com saltos configurados.
- Segredos em gerenciador do ambiente; não copiar `.env` para a imagem. Remover credenciais de migração do runtime.
- Rolling deploy com readiness; testar também indisponibilidade de Redis/PostgreSQL.
- Backups criptografados, recuperação point-in-time e teste periódico de restauração em ambiente separado.
- Volume local de arquivos exige backup próprio; depois da migração S3, definir versionamento e lifecycle.
- Não usar os usuários do seed para contas comerciais.

## Logs e métricas

Pino emite JSON com request id, rota, status e duração. Quando `LOG_FILE` é configurado, escreve também em volume de logs. Alloy lê esse volume somente como arquivo; não recebe o socket privilegiado do Docker. Loki centraliza e Grafana oferece consulta. O perfil `observability` é opcional no Compose e ainda requer homologação operacional.

Monitorar p95/p99 HTTP, taxas de 401/403/409/429/5xx, conexão DB, lock waits, disponibilidade Redis, idade de outbox, tentativas/FAILED, erros de exportação e disco de uploads/logs. Aplicar rotação de logs e retenção no Loki antes do uso contínuo; a configuração local não administra retenção longa.

Propor SLO após o piloto, por exemplo disponibilidade de reserva e latência de confirmação. Definir janela, população, exclusões e erro permitido antes de contratar SLA. Não chamar os valores planejados de garantia já existente.

## Recuperação

Runbook mínimo: localizar request id → verificar status tenant/plano → consultar logs e dependências → reconciliar transação no banco → decidir reprocessamento. Não refinalizar manualmente duplicando pagamento. Notificações FAILED são reprocessadas somente com a mesma chave e autorização vigente. Verificar possível aceite anterior pelo provedor antes de reenviar uma mensagem com resultado incerto.

Restore: restaurar banco/arquivos em ambiente separado, aplicar checagem de RLS e vínculos, verificar snapshots/comissões/saldo de estoque, autenticar duas empresas e provar isolamento, só então planejar corte. Testes automatizados exigem banco descartável e nunca executam contra produção.
