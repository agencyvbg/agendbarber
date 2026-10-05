import { Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import Redis from 'ioredis';
import { randomBytes } from 'node:crypto';

@Injectable()
export class GoogleIdentity {
  private client = new OAuth2Client();
  private redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  });
  constructor() {
    this.redis.on('error', () => {});
    void this.redis.connect().catch(() => {});
  }
  async challenge() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return { enabled: false as const };
    const nonce = randomBytes(32).toString('base64url');
    await this.redis.set(`google:nonce:${nonce}`, 'ready', 'EX', 300);
    return { enabled: true as const, clientId, nonce };
  }
  async verify(credential: string, nonce?: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new ServiceUnavailableException('Login Google ainda não configurado.');
    if (!nonce)
      throw new UnauthorizedException('Reabra o acesso Google para iniciar uma nova tentativa.');
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Identidade Google inválida ou expirada.');
    }
    if (
      !payload?.sub ||
      !payload.email ||
      !payload.email_verified ||
      (payload as any).nonce !== nonce
    )
      throw new UnauthorizedException('Identidade Google inválida.');
    const consumed = await this.redis.eval(
      "local v=redis.call('GET',KEYS[1]); if v then redis.call('DEL',KEYS[1]) end; return v",
      1,
      `google:nonce:${nonce}`,
    );
    if (consumed !== 'ready')
      throw new UnauthorizedException('Tentativa Google expirada ou já utilizada.');
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name || payload.email.split('@')[0],
    };
  }
  async onModuleDestroy() {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
