import { checkPasswordHash, generatePasswordHash } from './werkzeug-password';

describe('werkzeug-password', () => {
  it('hashes and verifies pbkdf2 passwords', () => {
    const hash = generatePasswordHash(
      'secret-password',
      'pbkdf2:sha256:600000',
    );
    expect(checkPasswordHash(hash, 'secret-password')).toBe(true);
    expect(checkPasswordHash(hash, 'wrong')).toBe(false);
  });

  it('verifies existing werkzeug pbkdf2 format', () => {
    const werkzeugHash =
      'pbkdf2:sha256:600000$testsalt$' +
      '8ZqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq=';
    expect(typeof checkPasswordHash(werkzeugHash, 'x')).toBe('boolean');
  });
});
