import { Catch, ExceptionFilter, ArgumentsHost, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import pino from 'pino';
export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'password',
        'passwordHash',
        'refreshToken',
        'accessToken',
        'credential',
        'googleSubject',
      ],
      censor: '[REDACTED]',
    },
  },
  process.env.LOG_FILE
    ? pino.multistream([
        { stream: process.stdout },
        { stream: pino.destination(process.env.LOG_FILE) },
      ])
    : process.stdout,
);
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse(),
      req = host.switchToHttp().getRequest();
    let status = 500,
      message = 'Erro interno. Consulte o suporte com o código da requisição.';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : (body as any).message;
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = 409;
        message = 'Já existe um registro com esses dados.';
      }
      if (['P2003', 'P2025'].includes(exception.code)) {
        status = 404;
        message = 'Referência ou registro não encontrado nesta empresa.';
      }
      if (['P2010', 'P2004'].includes(exception.code)) {
        status = 409;
        message = 'Operação em conflito com as regras do banco.';
      }
    }
    if (status >= 500)
      logger.error(
        {
          requestId: req.requestId,
          error: exception instanceof Error ? exception.message : 'unknown',
        },
        'Request failed',
      );
    res.status(status).json({ statusCode: status, message, requestId: req.requestId });
  }
}
