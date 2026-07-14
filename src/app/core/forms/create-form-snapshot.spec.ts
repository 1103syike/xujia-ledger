import {
  createFormSnapshotsEqual,
  serializeCreateFormSnapshot,
} from './create-form-snapshot';

describe('create-form-snapshot', () => {
  const base = () =>
    serializeCreateFormSnapshot({
      mode: 'advance',
      advance: {
        title: '超商',
        date: '2026-06-23',
        totalAmount: 100,
        serviceFee: null,
        billTotal: null,
        skippedMembers: ['m2'],
        memberItems: {},
        manualAmounts: { m1: 50, m3: 50 },
        splitAmountInputs: {},
        splitLocked: [],
        payerRows: [{ memberId: 'm1', amount: '100', locked: false }],
        remainderSeed: 'seed-1',
        activeParticipantKey: 'm1,m3',
      },
      repayment: { toMemberId: '', amount: null, date: '2026-06-23' },
      transfer: { selectedSourceIds: [] },
    });

  it('treats equivalent snapshots as equal', () => {
    const a = base();
    const b = serializeCreateFormSnapshot({
      mode: 'advance',
      advance: {
        title: ' 超商 ',
        date: '2026-06-23',
        totalAmount: 100,
        serviceFee: null,
        billTotal: null,
        skippedMembers: ['m2'],
        memberItems: {},
        manualAmounts: { m3: 50, m1: 50 },
        splitAmountInputs: {},
        splitLocked: [],
        payerRows: [{ memberId: 'm1', amount: '100', locked: false }],
        remainderSeed: 'seed-1',
        activeParticipantKey: 'm1,m3',
      },
      repayment: { toMemberId: '', amount: null, date: '2026-06-23' },
      transfer: { selectedSourceIds: [] },
    });
    expect(createFormSnapshotsEqual(a, b)).toBe(true);
  });

  it('detects mode changes', () => {
    const a = base();
    const b = serializeCreateFormSnapshot({
      mode: 'repayment',
      advance: {
        title: '超商',
        date: '2026-06-23',
        totalAmount: 100,
        serviceFee: null,
        billTotal: null,
        skippedMembers: ['m2'],
        memberItems: {},
        manualAmounts: { m1: 50, m3: 50 },
        splitAmountInputs: {},
        splitLocked: [],
        payerRows: [{ memberId: 'm1', amount: '100', locked: false }],
        remainderSeed: 'seed-1',
        activeParticipantKey: 'm1,m3',
      },
      repayment: { toMemberId: '', amount: null, date: '2026-06-23' },
      transfer: { selectedSourceIds: [] },
    });
    expect(createFormSnapshotsEqual(a, b)).toBe(false);
  });
});
