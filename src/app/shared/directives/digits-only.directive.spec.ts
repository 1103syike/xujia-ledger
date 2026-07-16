import { keepDigitsOnly } from './digits-only.directive';

describe('keepDigitsOnly', () => {
  it('只保留數字', () => {
    expect(keepDigitsOnly('12a3中文b')).toBe('123');
    expect(keepDigitsOnly('NT$ 1,200')).toBe('1200');
    expect(keepDigitsOnly('1e2+3-4.5')).toBe('12345');
  });

  it('空值回空字串', () => {
    expect(keepDigitsOnly('')).toBe('');
    expect(keepDigitsOnly(null)).toBe('');
    expect(keepDigitsOnly(undefined)).toBe('');
  });
});
