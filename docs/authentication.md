# Acesso e cadastro por perfil

O painel não abre automaticamente em uma identidade fictícia. A entrada apresenta três áreas, com URLs próprias:

| Área                       | URL        | Contas permitidas  |
| -------------------------- | ---------- | ------------------ |
| Proprietário da plataforma | `/master`  | MASTER             |
| Barbearia                  | `/app`     | EMPRESA e BARBEIRO |
| Cliente                    | `/cliente` | CLIENTE            |

Escolher uma área não concede um cargo. O servidor verifica a área solicitada contra o perfil persistido da conta, antes de emitir tokens. O frontend usa a identidade retornada pela API e não oferece troca de cargos na conta ou sidebar. Master não herda a unidade de uma barbearia na interface.

## Cadastro por email

- Na área Barbearia, **Sou dono de uma barbearia. Criar conta** provisiona um tenant, uma empresa no plano START, um gestor EMPRESA, uma unidade e seu expediente. Nome, identificador, nome do gestor, email e senha são obrigatórios. Não há escolha pública de cargo ou plano; campos adicionais são rejeitados. A cobrança recorrente ainda não está integrada.
- Na área Cliente, **Ainda não tenho conta. Cadastrar** cria somente CLIENTE na barbearia identificada. Respeita empresa ativa, limite do plano, email e telefone únicos e consentimento de WhatsApp.
- O gestor cria contas de equipe pela API `/users`. Não há cadastro público de BARBEIRO ou MASTER.
- A conta Master inicial é criada pelo seed; use slug `master`, email `master@barberhub.local` e a senha que você definiu em `SEED_PASSWORD`. Em produção, substitua a identidade de desenvolvimento por sua conta restrita.

Senhas são armazenadas com bcrypt. A verificação de propriedade do email e recuperação de senha ainda estão no roadmap; cadastro por email não significa email confirmado.

## Login, persistência e saída

Login envia slug, email, senha e `portal`. Slug Master é resolvido pela área Plataforma, sem campo editável. Conta de outra área é recusada. JWT permanece em memória e refresh em cookie HttpOnly, Secure em produção, SameSite Strict. Ao recarregar, a interface rotaciona o refresh e consulta `/auth/me` para recuperar identidade e permissões.

**Sair da conta** fica na sidebar e no diálogo **Sua conta**. Revoga a família de refresh, remove cookie e limpa tokens, identidade e cache. A interface retorna à tela de acesso. Se o servidor estiver indisponível, a saída local ocorre e a interface avisa que a revogação remota não foi confirmada. JWT já emitido conserva sua expiração de 15 minutos; invalidação imediata de access tokens ainda exigiria denylist/versionamento de sessão.

## Google Identity Services

Implementação com o SDK oficial do navegador e `google-auth-library` no servidor. A API verifica assinatura, issuer, audience, expiração, email verificado e nonce. O nonce é vinculado a cookie HttpOnly e consumido uma única vez no Redis, com validade de cinco minutos. A identidade é vinculada pelo `sub` do Google, com unicidade dentro do tenant.

1. Crie um OAuth Client ID do tipo **Web application** no Google Cloud e configure a tela de consentimento.
2. Cadastre a origem exata usada pelo frontend (por exemplo `http://127.0.0.1:5174` e seu domínio HTTPS de produção).
3. Coloque o Client ID em `GOOGLE_CLIENT_ID` no `.env` da API. Não é necessário expor segredo de cliente no frontend para este fluxo de ID token.
4. Reinicie a API. O frontend consulta `/auth/google/config` e passa a exibir o botão oficial.

Fontes: [configuração oficial](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [verificação de ID token no servidor](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

Uma conta existente não é vinculada automaticamente por coincidência de email. Entre com senha, abra **Sua conta** e vincule o Google usando o mesmo email. Depois pode entrar com Google na área e barbearia corretas. Cliente pode criar uma nova conta com Google pela tela de cadastro, informando telefone e consentimento; o servidor atribui exclusivamente CLIENTE. Gestor, barbeiro e Master precisam de conta já provisionada e vínculo explícito. O cadastro de uma nova barbearia usa email e senha nesta versão.

Sem `GOOGLE_CLIENT_ID`, o Google fica desabilitado com mensagem clara. Não há botão que simula sucesso. O envio de tokens reais Google depende de credenciais e consentimento configurados e não foi homologado nesta sessão.

## Atualizar a instalação

Na raiz `C:\user\bruno\dev\clientes\agendbarber`:

```sh
npm ci
npm run db:generate
npm run db:migrate
npm run dev:api
```

Configure `.env` e inicie PostgreSQL/Redis antes desses comandos, conforme README. A migração `202610040003_google_identity` acrescenta `google_subject` à tabela users. O frontend continua com `npm run dev`. Se o Vite utilizar outra porta, inclua sua origem em `WEB_ORIGIN` e nas origens do Google.

## Demonstração

Somente a tela de acesso oferece uma prévia explicitamente identificada com dados fictícios. Abrir uma prévia não autentica nem emite tokens. Dentro dela não há seletor para trocar de cargo; **Sair da demonstração** retorna à entrada. O login real exige API, banco e Redis; executar só o Vite não cria contas persistentes.
