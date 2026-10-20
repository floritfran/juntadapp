import {
  buildSettlementSummaryText,
  SettlementSummary,
} from '../../../src/domain/expenses/settlement-summary';

const summary = (overrides?: Partial<SettlementSummary>): SettlementSummary => ({
  title: 'Juntada del asado',
  totalInt: 45000,
  transfers: [
    { fromName: 'Juan', toName: 'Pedro', amount: 15000 },
    { fromName: 'Ana', toName: 'Pedro', amount: 12500 },
  ],
  ...overrides,
});

describe('settlement summary text', () => {
  test('builds the text with title, total and one line per transfer', () => {
    const text = buildSettlementSummaryText(summary());
    expect(text).toBe(
      [
        '💰 Juntada del asado',
        'Total gastado: $ 45.000',
        '',
        'A pagar:',
        'Juan le pasa $ 15.000 a Pedro',
        'Ana le pasa $ 12.500 a Pedro',
      ].join('\n')
    );
  });

  test('says everything is settled when there are no transfers', () => {
    const text = buildSettlementSummaryText(summary({ transfers: [] }));
    expect(text).toBe(
      ['💰 Juntada del asado', 'Total gastado: $ 45.000', '', 'Ya está todo saldado ✅'].join('\n')
    );
  });

  test('formats money with grouped digits and no cents', () => {
    const text = buildSettlementSummaryText(
      summary({
        totalInt: 1234567,
        transfers: [{ fromName: 'Facu', toName: 'Lu', amount: 999 }],
      })
    );
    expect(text).toContain('Total gastado: $ 1.234.567');
    expect(text).toContain('Facu le pasa $ 999 a Lu');
  });

  test('single transfer produces a single payment line', () => {
    const text = buildSettlementSummaryText(
      summary({ transfers: [{ fromName: 'Juan', toName: 'Pedro', amount: 500 }] })
    );
    expect(text.split('\n').filter((line) => line.includes('le pasa'))).toHaveLength(1);
  });
});
