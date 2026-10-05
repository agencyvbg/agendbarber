import { TenantRepository } from '../domain/repository';
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Database } from '../infrastructure/database';
import { Actor } from '../domain/policy';
@Injectable()
export class ReportsService {
  constructor(@Inject(TenantRepository) private db: TenantRepository) {}
  async export(actor: Actor, kind: string, format: 'pdf' | 'xlsx', from: Date, to: Date) {
    const rows = await this.db.transaction(actor, async (tx) => {
      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.id,
          action: 'EXPORT',
          resource: kind,
          metadata: { format, from: from.toISOString(), to: to.toISOString() },
        },
      });
      const apps = await tx.appointment.findMany({
        where: { tenantId: actor.tenantId, startsAt: { gte: from, lte: to } },
        include: { barber: true, client: true, service: true },
        orderBy: { startsAt: 'asc' },
        take: 10000,
      });
      switch (kind) {
        case 'agendamentos':
          return apps.map((a) => ({
            Data: a.startsAt.toISOString(),
            Cliente: a.client.name,
            Barbeiro: a.barber.name,
            Serviço: a.service.name,
            Status: a.status,
            'Valor R$': a.priceCents / 100,
          }));
        case 'receita':
          return (
            await tx.financialEntry.findMany({
              where: { tenantId: actor.tenantId, occurredAt: { gte: from, lte: to } },
              orderBy: { occurredAt: 'asc' },
              take: 10000,
            })
          ).map((e) => ({
            Data: e.occurredAt.toISOString(),
            Descrição: e.description,
            Tipo: e.type,
            'Valor R$': e.amountCents / 100,
            Pagamento: e.method,
          }));
        case 'comissoes':
          return (
            await tx.commission.findMany({
              where: { tenantId: actor.tenantId, createdAt: { gte: from, lte: to } },
              include: { barber: true },
              take: 10000,
            })
          ).map((c) => ({
            Data: c.createdAt.toISOString(),
            Barbeiro: c.barber.name,
            Percentual: c.percent,
            'Comissão R$': c.amountCents / 100,
          }));
        case 'clientes':
          return (
            await tx.client.findMany({
              where: { tenantId: actor.tenantId, createdAt: { gte: from, lte: to } },
              take: 10000,
            })
          ).map((c) => ({
            Nome: c.name,
            Telefone: c.phone,
            Email: c.email || '',
            Cadastro: c.createdAt.toISOString(),
          }));
        case 'servicos':
          return (await tx.service.findMany({ where: { tenantId: actor.tenantId } })).map((s) => ({
            Serviço: s.name,
            Duração: s.durationMinutes,
            'Preço R$': s.priceCents / 100,
            Atendimentos: apps.filter((a) => a.serviceId === s.id && a.status === 'FINALIZADO')
              .length,
          }));
        case 'barbeiros':
          return (await tx.barber.findMany({ where: { tenantId: actor.tenantId } })).map((b) => ({
            Nome: b.name,
            Comissão: b.commissionPercent,
            Atendimentos: apps.filter((a) => a.barberId === b.id && a.status === 'FINALIZADO')
              .length,
            'Receita R$':
              apps
                .filter((a) => a.barberId === b.id && a.status === 'FINALIZADO')
                .reduce((s, a) => s + a.priceCents, 0) / 100,
          }));
        default:
          throw new BadRequestException('Relatório inválido.');
      }
    });
    if (format === 'xlsx') {
      const book = new ExcelJS.Workbook();
      book.creator = 'BarberHub';
      const sheet = book.addWorksheet(kind);
      const keys = rows.length ? Object.keys(rows[0]) : ['Nenhum registro no período'];
      sheet.columns = keys.map((key) => ({ header: key, key, width: 28 }));
      for (const row of rows) sheet.addRow(row);
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8052DF' } };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      return Buffer.from(await book.xlsx.writeBuffer());
    }
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 42 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.fontSize(24).fillColor('#8052df').text(`BarberHub · ${kind}`);
      doc
        .moveDown()
        .fillColor('#444444')
        .fontSize(10)
        .text(
          `${from.toISOString().slice(0, 10)} a ${to.toISOString().slice(0, 10)} · ${rows.length} registros`,
        );
      doc.moveDown();
      if (!rows.length) doc.text('Nenhum registro no período.');
      for (const row of rows) {
        if (doc.y > 730) doc.addPage();
        doc
          .fontSize(9)
          .fillColor('#222222')
          .text(
            Object.entries(row)
              .map(([k, v]) => `${k}: ${v}`)
              .join('  |  '),
            { lineGap: 4 },
          );
        doc.moveDown(0.5);
      }
      doc.end();
    });
  }
}
