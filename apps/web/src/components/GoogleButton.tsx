import { useEffect, useRef, useState } from 'react';
import { googleConfig } from '../lib/data';

type GoogleSdk = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        nonce: string;
        callback: (result: { credential: string }) => void;
        auto_select: boolean;
      }) => void;
      renderButton: (
        element: HTMLElement,
        options: { theme: string; size: string; text: string; width: number },
      ) => void;
    };
  };
};
declare global {
  interface Window {
    google?: GoogleSdk;
  }
}
let sdkPromise: Promise<void> | undefined;
function loadSdk() {
  if (window.google) return Promise.resolve();
  if (!sdkPromise)
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        sdkPromise = undefined;
        reject(new Error('Não foi possível carregar o Google.'));
      };
      document.head.appendChild(script);
    });
  return sdkPromise;
}
export function GoogleButton({
  onCredential,
}: {
  onCredential: (credential: string) => Promise<void>;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  callback.current = onCredential;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState('Carregando acesso Google…');
  useEffect(() => {
    let active = true;
    void (async () => {
      const config = await googleConfig();
      if (!config.enabled) {
        if (active) setState('Google ainda não habilitado nesta instalação.');
        return;
      }
      await loadSdk();
      if (!active || !holder.current || !window.google) return;
      holder.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: config.clientId,
        nonce: config.nonce,
        auto_select: false,
        callback: async ({ credential }) => {
          try {
            await callback.current(credential);
          } catch {
            if (active) setAttempt((value) => value + 1);
          }
        },
      });
      window.google.accounts.id.renderButton(holder.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: 280,
      });
      setState('');
    })().catch(() => {
      if (active) setState('Google indisponível. Você pode entrar com email e senha.');
    });
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <div className="google-access">
      <div ref={holder} />
      {state && <p className="auth-note">{state}</p>}
    </div>
  );
}
