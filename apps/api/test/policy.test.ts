import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransition,
  calculateCommission,
  overlaps,
  appointmentScope,
  withinLimit,
  planDefinitions,
} from '../src/domain/policy';
test('customer cannot complete an appointment or change a terminal status', () => {
  assert.equal(canTransition('AGENDADO', 'FINALIZADO', 'CLIENTE'), false);
  assert.equal(canTransition('AGENDADO', 'CANCELADO', 'CLIENTE'), true);
  assert.equal(canTransition('FINALIZADO', 'CANCELADO', 'EMPRESA'), false);
  assert.equal(canTransition('CONFIRMADO', 'EM_ATENDIMENTO', 'BARBEIRO'), true);
  assert.equal(canTransition('EM_ATENDIMENTO', 'FINALIZADO', 'BARBEIRO'), true);
});
test('adjacent bookings do not overlap; partial intervals do', () => {
  const a = { startsAt: new Date('2030-01-01T09:00Z'), endsAt: new Date('2030-01-01T09:30Z') };
  assert.equal(overlaps(a, { startsAt: a.endsAt, endsAt: new Date('2030-01-01T10:00Z') }), false);
  assert.equal(
    overlaps(a, { startsAt: new Date('2030-01-01T09:29Z'), endsAt: new Date('2030-01-01T10:00Z') }),
    true,
  );
});
test('integer cents and commission snapshots round once', () => {
  assert.equal(calculateCommission(5000, 60), 3000);
  assert.equal(calculateCommission(999, 55), 549);
  assert.throws(() => calculateCommission(0, 101));
  assert.throws(() => calculateCommission(-100, 60));
});
test('barber/client scopes fail closed without linked identities', () => {
  assert.deepEqual(appointmentScope({ id: 'u', tenantId: 't', role: 'BARBEIRO', barberId: 'b' }), {
    barberId: 'b',
  });
  assert.throws(() => appointmentScope({ id: 'u', tenantId: 't', role: 'CLIENTE' }));
  assert.throws(() => appointmentScope({ id: 'u', tenantId: 't', role: 'MASTER' }));
});
test('plan caps have explicit unlimited semantics', () => {
  assert.equal(withinLimit(2, 2), false);
  assert.equal(withinLimit(200, 200), false);
  assert.equal(withinLimit(10000, null), true);
  assert.equal(planDefinitions[0].features.includes('commissions'), false);
  assert.equal(planDefinitions[2].features.includes('stock'), true);
});
