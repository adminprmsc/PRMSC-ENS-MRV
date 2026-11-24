import { formatMessageNumber } from './number-format.util';

describe('formatMessageNumber', () => {
  it.each([
    [1.8166666666666667, '1.82'],
    [3.3833333333333333, '3.38'],
    [2.5833333333333335, '2.58'],
    [55214.0, '55214'],
    [0, '0'],
    [-0.001, '0'],
    [12.5, '12.5'],
    ['7.129', '7.13'],
  ])('%p → %p', (v, out) => {
    expect(formatMessageNumber(v)).toBe(out);
  });

  it.each([null, undefined, '', 'abc', NaN, Infinity])('%p → N/A', (v) => {
    expect(formatMessageNumber(v as never)).toBe('N/A');
  });
});
