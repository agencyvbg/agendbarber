import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Scissors, ShieldCheck, Building2, UserRound, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Field } from '../components/shared';
import { GoogleButton } from '../components/GoogleButton';
import {
  login,
  registerClient,
  registerCompany,
  googleLogin,
  type AuthPortal,
  type Role,
} from '../lib/data';

const schema = z.object({
  slug: z.string(),
  email: z.string().email('Informe um email válido.'),
  password: z.string().min(8, 'Use pelo menos 8 caracteres.').max(128),
  name: z.string(),
  company: z.string(),
  phone: z.string(),
  consent: z.boolean(),
});
type Values = z.infer<typeof schema>;
const portals = {
  team: {
    label: 'Barbearia',
    title: 'Cuide do seu negócio.',
    description:
      'Acesso do gestor e da equipe. Cada profissional vê apenas o que seu perfil permite.',
    icon: Building2,
  },
  client: {
    label: 'Cliente',
    title: 'Seu próximo corte começa aqui.',
    description: 'Reserve um horário, acompanhe seus agendamentos e seu histórico.',
    icon: UserRound,
  },
  master: {
    label: 'Plataforma',
    title: 'Sua plataforma, em perspectiva.',
    description:
      'Acesso exclusivo do proprietário do BarberHub. Gerencie empresas, planos e indicadores.',
    icon: ShieldCheck,
  },
};
export function AuthPage({
  onSession,
  onDemo,
  initialPortal = 'team',
}: {
  onSession: (user: any) => void;
  onDemo: (role: Role) => void;
  initialPortal?: AuthPortal;
}) {
  const [portal, setPortal] = useState<AuthPortal>(initialPortal);
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      slug: '',
      email: '',
      password: '',
      name: '',
      company: '',
      phone: '',
      consent: false,
    },
  });
  const info = portals[portal];
  const businessSlug = (values: Values) => (portal === 'master' ? 'master' : values.slug.trim());
  const validateRegistration = (values: Values) => {
    if (signup && values.password.length < 12)
      throw new Error('Crie uma senha com pelo menos 12 caracteres.');
    if (signup && values.name.trim().length < 2) throw new Error('Informe seu nome completo.');
    if (portal !== 'master' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug))
      throw new Error('Use o identificador da barbearia, em letras minúsculas e sem espaços.');
    if (
      signup &&
      portal === 'team' &&
      (values.company.trim().length < 2 || values.slug === 'master')
    )
      throw new Error('Informe o nome e um identificador válido para sua barbearia.');
    if (signup && portal === 'client' && !/^\+?[\d\s()-]{10,20}$/.test(values.phone))
      throw new Error('Informe seu telefone com DDD.');
  };
  const submit = form.handleSubmit(async (values) => {
    setBusy(true);
    setError('');
    try {
      validateRegistration(values);
      const result = signup
        ? portal === 'client'
          ? await registerClient({
              slug: values.slug,
              name: values.name,
              phone: values.phone,
              email: values.email,
              password: values.password,
              whatsappConsent: values.consent,
            })
          : await registerCompany({
              name: values.company,
              slug: values.slug,
              admin: { name: values.name, email: values.email, password: values.password },
            })
        : await login(businessSlug(values), values.email, values.password, portal);
      onSession(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  });
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <a className="brand" href="#">
          <span className="brand-mark">
            <Scissors size={22} />
          </span>
          <span>
            barberhub<span className="brand-dot">.</span>
          </span>
        </a>
        <div>
          <span className="auth-eyebrow">{info.label.toUpperCase()}</span>
          <h1>{info.title}</h1>
          <p>{info.description}</p>
          <div className="auth-separation">
            <ShieldCheck size={20} />
            <span>Uma conta. Seu perfil. Seus dados protegidos.</span>
          </div>
        </div>
        <small>Gestão que acompanha o ritmo de cada atendimento.</small>
      </section>
      <main className="auth-main">
        <nav className="auth-portals" aria-label="Área de acesso">
          {(Object.keys(portals) as AuthPortal[]).map((p) => (
            <button
              key={p}
              aria-pressed={portal === p}
              onClick={() => {
                setPortal(p);
                history.replaceState(
                  null,
                  '',
                  p === 'master' ? '/master' : p === 'client' ? '/cliente' : '/app',
                );
                setSignup(false);
                setError('');
                form.reset();
              }}
            >
              {portals[p].label}
            </button>
          ))}
        </nav>
        <div className="auth-form-card">
          <info.icon size={27} className="text-primary" />
          <h2>
            {signup
              ? portal === 'team'
                ? 'Crie sua barbearia'
                : 'Crie sua conta'
              : 'Bem-vindo de volta'}
          </h2>
          <p>
            {signup
              ? portal === 'team'
                ? 'Sua conta será de gestor, no plano START de R$ 49/mês. A cobrança online ainda não está habilitada.'
                : 'Cadastre-se na sua barbearia para agendar.'
              : 'Entre com sua conta para acessar sua área.'}
          </p>
          <form onSubmit={submit} className="form-grid">
            {signup && (
              <Field label="Seu nome">
                <Input autoComplete="name" {...form.register('name')} required />
              </Field>
            )}
            {signup && portal === 'team' && (
              <Field label="Nome da barbearia">
                <Input {...form.register('company')} required />
              </Field>
            )}
            {portal !== 'master' && (
              <Field
                label={
                  signup && portal === 'team'
                    ? 'Identificador da nova barbearia'
                    : 'Identificador da barbearia'
                }
              >
                <Input placeholder="studio-original" {...form.register('slug')} required />
                <small className="auth-note">
                  {signup && portal === 'team'
                    ? 'Ex.: minha-barbearia. Use letras minúsculas e hífens.'
                    : 'Peça este identificador à sua barbearia.'}
                </small>
              </Field>
            )}
            {signup && portal === 'client' && (
              <Field label="Telefone com DDD">
                <Input autoComplete="tel" type="tel" {...form.register('phone')} required />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" autoComplete="username" {...form.register('email')} required />
              {form.formState.errors.email && (
                <small role="alert">{form.formState.errors.email.message}</small>
              )}
            </Field>
            <Field label="Senha">
              <Input
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                {...form.register('password')}
                minLength={signup ? 12 : 8}
                required
              />
              {form.formState.errors.password && (
                <small role="alert">{form.formState.errors.password.message}</small>
              )}
            </Field>
            {signup && portal === 'client' && (
              <label className="auth-consent">
                <input type="checkbox" {...form.register('consent')} />
                Quero receber lembretes e mensagens por WhatsApp.
              </label>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <Button disabled={busy} type="submit">
              {busy ? 'Aguarde…' : signup ? 'Criar conta' : 'Entrar'}
              <ArrowRight size={16} />
            </Button>
          </form>
          {portal !== 'master' && (
            <button
              className="auth-text-button"
              onClick={() => {
                setSignup(!signup);
                setError('');
              }}
            >
              {signup
                ? 'Já tenho uma conta. Entrar'
                : portal === 'team'
                  ? 'Sou dono de uma barbearia. Criar conta'
                  : 'Ainda não tenho conta. Cadastrar'}
            </button>
          )}
          {portal === 'master' && (
            <p className="auth-note">
              Contas Master são provisionadas pelo proprietário. Não há cadastro público para esta
              área.
            </p>
          )}
          {!(signup && portal === 'team') && (
            <>
              <div className="auth-divider">ou</div>
              <GoogleButton
                key={`${portal}:${signup}`}
                onCredential={async (credential) => {
                  setBusy(true);
                  setError('');
                  try {
                    const values = form.getValues();
                    if (portal !== 'master' && !values.slug.trim())
                      throw new Error('Informe primeiro o identificador da barbearia.');
                    if (signup && !/^\+?[\d\s()-]{10,20}$/.test(values.phone))
                      throw new Error('Informe seu telefone antes de cadastrar com Google.');
                    onSession(
                      await googleLogin(
                        businessSlug(values),
                        credential,
                        portal,
                        signup
                          ? { phone: values.phone, whatsappConsent: values.consent }
                          : undefined,
                      ),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                    throw e;
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </>
          )}
          <div className="auth-demo">
            <p>Quer conhecer antes de entrar?</p>
            <Button
              variant="ghost"
              onClick={() =>
                onDemo(portal === 'master' ? 'MASTER' : portal === 'client' ? 'CLIENTE' : 'EMPRESA')
              }
            >
              Abrir demonstração de {info.label.toLowerCase()}
            </Button>
            <small>Dados fictícios. Não é uma sessão autenticada.</small>
          </div>
        </div>
      </main>
    </div>
  );
}
