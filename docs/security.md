# Segurança e permissões

Acesso possui áreas separadas `/master`, `/app` e `/cliente`. O portal solicitado é validado contra o cargo persistido antes de emitir tokens. Não há troca de cargos no menu de conta. Cadastro público não aceita `role` ou plano: cria CLIENTE, ou provisiona EMPRESA no START pela rota de nova barbearia. Contas de equipe vêm do gestor; MASTER é restrito. Consulte [Autenticação](authentication.md) para cadastro, logout, restauração de sessão e vínculo Google explícito com nonce de uso único.

## Matriz

| Operação                                          | MASTER              | EMPRESA        | BARBEIRO                              | CLIENTE                                 |
| ------------------------------------------------- | ------------------- | -------------- | ------------------------------------- | --------------------------------------- |
| Provisionar/suspender/ativar empresa              | Sim                 | Não            | Não                                   | Não                                     |
| Alterar plano e ver métricas globais              | Sim                 | Não            | Não                                   | Não                                     |
| Dados operacionais da barbearia                   | Via métricas Master | Seu tenant     | Seu escopo                            | Seu escopo                              |
| Criar/editar cliente, serviço, unidade e barbeiro | Não                 | Sim            | Não                                   | Perfil próprio pela API                 |
| Listar clientes                                   | Não                 | Seu tenant     | Clientes de seus atendimentos         | Apenas seu perfil                       |
| Listar agenda                                     | Não                 | Seu tenant     | Apenas própria agenda                 | Apenas próprios agendamentos            |
| Reservar/reagendar                                | Não                 | Sim            | Própria agenda, clientes do histórico | Apenas para si                          |
| Iniciar/finalizar atendimento                     | Não                 | Sim            | Apenas seus atendimentos              | Não                                     |
| Cancelar                                          | Não                 | Sim            | Própria agenda                        | Próprios agendados/confirmados          |
| Avaliar                                           | Não                 | Não            | Não                                   | Próprio atendimento finalizado          |
| Financeiro, estoque e exportação                  | Não                 | Conforme plano | Não                                   | Não                                     |
| Comissões                                         | Não                 | Conforme plano | Apenas próprias, conforme plano       | Não                                     |
| Criar contas de equipe                            | Não                 | Seu tenant     | Não                                   | Cadastro público exclusivamente CLIENTE |
| Download de upload                                | Não                 | Seu tenant     | Apenas seus arquivos                  | Apenas seus arquivos                    |

O MASTER não é uma autorização irrestrita para todos os endpoints operacionais. Possui rotas próprias. Métricas de empresa são leitura administrativa; ações Master geram auditoria no tenant de plataforma com identificação da empresa afetada.

## Planos: controle do servidor

| Plano                     |   Unidades |  Barbeiros |   Clientes | Recursos adicionais                                                           |
| ------------------------- | ---------: | ---------: | ---------: | ----------------------------------------------------------------------------- |
| START — R$49              |          1 |          2 |        200 | Agenda, serviços, clientes, agendamento online                                |
| PRO — R$99                |          1 |          8 | Ilimitados | Dashboard, WhatsApp, comissões, financeiro básico, relatórios                 |
| PREMIUM — R$199           |          3 |         25 | Ilimitados | Multiunidade, estoque, CRM, metas, executivo, financeiro avançado             |
| ENTERPRISE — sob consulta | Ilimitadas | Ilimitados | Ilimitados | White label, API e SLA como capacidades do contrato, a implementar no roadmap |

`null` significa ilimitado. Limites de criação são serializados por tenant e recurso antes de contar os registros. Redução de plano é recusada se o uso exceder o novo limite. Não se apagam dados para acomodar um downgrade. Funcionalidades dependem de `features` do plano e dos guards da API, além da navegação do frontend.

## Sessões

Access token JWT HS256: 15 minutos, issuer/audience fixos e segredo obrigatório de pelo menos 32 caracteres. Perfil, vínculo barbeiro/cliente, usuário ativo e empresa ativa são novamente verificados a cada requisição autenticada. Não se confia apenas no papel declarado pelo cliente.

Refresh token: 48 bytes aleatórios, hash SHA-256 no banco, duração de 7 dias, cookie HttpOnly/SameSite Strict. Rotação invalida o anterior. Reutilização revoga a família de sessões; o frontend compartilha uma única renovação para evitar refresh concorrente das consultas. Logout revoga refresh da família. Um JWT já emitido conserva sua expiração; desativação de usuário ou suspensão de empresa bloqueia suas requisições pela verificação de estado.

Em produção use HTTPS e `NODE_ENV=production`, que ativa cookie Secure. O exemplo Compose é de desenvolvimento local. Senhas são bcrypt com custo 12; o seed não contém senha fixa. Recuperação de senha, verificação de email, MFA e políticas de sessão Enterprise estão no roadmap.

## Camadas de defesa

1. Rate limit Redis por IP: 20/minuto para autenticação/cadastro e 120/minuto para demais rotas. Sem Redis retorna 503.
2. CORS e validação de Origin em requisições mutáveis; não aceitar origens wildcard com credenciais.
3. JWT e estado ativo da conta/empresa.
4. Perfil e features por endpoint.
5. Escopo individual de barbeiro/cliente nos casos de uso.
6. DTO Zod estrito; campos como tenant, papel ou preço de uma reserva não são aceitos no payload de agendamento.
7. FKs compostas e RLS forçada com papel runtime sem BYPASSRLS.
8. Constraints de intervalos, valores e locks de concorrência.
9. Auditoria no mesmo commit do evento de negócio.
10. Upload privado com assinatura binária, limite de tamanho, nome gerado e download autenticado como attachment.

Todas as consultas raw do fluxo HTTP são parametrizadas. O contexto Master não é exposto como um parâmetro de requisição. O papel de migração deve existir somente no job de migração/seed e na operação de banco, não no contêiner de API.

## Dados pessoais

Consentimento de WhatsApp é explícito, falso por padrão e revalidado antes do envio. Notificações não são enviadas a empresas suspensas, clientes sem consentimento ou reservas canceladas. Logs registram método, caminho, status, duração e request id; não registram corpo de login, token ou mensagem pessoal. Exporte relatórios apenas por sessão autorizada.

A implantação comercial deve definir retenção de auditoria, exclusão/anônimização, atendimento a solicitações de titulares, termos e política de privacidade. Esses procedimentos precisam refletir a operação real do negócio; esta entrega não afirma certificação jurídica ou conformidade regulatória concluída.
