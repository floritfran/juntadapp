import {
  genericTotals,
  genericWinners,
  validateGenericAdjustment,
} from '../../../../src/domain/games/generic/generic-scorer';
import { GenericAdjustment } from '../../../../src/domain/games/generic/generic-types';

const adj = (id: string, personId: string, points: number): GenericAdjustment => ({
  id,
  personId,
  points,
  createdAt: new Date(0),
});

describe('juego genérico - validación', () => {
  test('acepta cualquier entero distinto de cero', () => {
    expect(() => validateGenericAdjustment(1)).not.toThrow();
    expect(() => validateGenericAdjustment(-5)).not.toThrow();
    expect(() => validateGenericAdjustment(1000)).not.toThrow();
    expect(() => validateGenericAdjustment(-1000)).not.toThrow();
  });

  test('rechaza cero y valores no enteros', () => {
    expect(() => validateGenericAdjustment(0)).toThrow();
    expect(() => validateGenericAdjustment(1.5)).toThrow();
    expect(() => validateGenericAdjustment(-2.5)).toThrow();
    expect(() => validateGenericAdjustment(Number.NaN)).toThrow();
  });
});

describe('juego genérico - totales', () => {
  test('suma ajustes positivos y negativos por jugador', () => {
    const adjustments = [adj('1', 'a', 10), adj('2', 'a', -3), adj('3', 'b', 5)];
    expect(genericTotals(['a', 'b'], adjustments)).toEqual([
      { personId: 'a', total: 7 },
      { personId: 'b', total: 5 },
    ]);
  });

  test('jugadores sin ajustes arrancan en cero', () => {
    expect(genericTotals(['a', 'b'], [])).toEqual([
      { personId: 'a', total: 0 },
      { personId: 'b', total: 0 },
    ]);
  });

  test('ordena de mayor a menor puntaje', () => {
    const adjustments = [adj('1', 'a', -4), adj('2', 'b', 9)];
    expect(genericTotals(['a', 'b'], adjustments).map((row) => row.personId)).toEqual(['b', 'a']);
  });

  test('en empate respeta el orden de los jugadores', () => {
    const adjustments = [adj('1', 'b', 2), adj('2', 'a', 2)];
    expect(genericTotals(['a', 'b'], adjustments).map((row) => row.personId)).toEqual(['a', 'b']);
  });
});

describe('juego genérico - ganador', () => {
  test('devuelve al jugador con mayor puntaje', () => {
    const totals = [
      { personId: 'a', total: 3 },
      { personId: 'b', total: 10 },
    ];
    expect(genericWinners(totals)).toEqual(['b']);
  });

  test('devuelve todos los empatados en el primer puesto', () => {
    const totals = [
      { personId: 'a', total: 10 },
      { personId: 'b', total: 10 },
      { personId: 'c', total: 1 },
    ];
    expect(genericWinners(totals)).toEqual(['a', 'b']);
  });

  test('vacío cuando no hay jugadores', () => {
    expect(genericWinners([])).toEqual([]);
  });
});