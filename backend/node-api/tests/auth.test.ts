import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { signupSchema, loginSchema } from '../src/modules/auth/auth.validation.js';
import { env } from '../src/config/env.js';

describe('Auth Module Unit Tests', () => {
  it('Hashes and verifies passwords securely using bcrypt', async () => {
    const rawPassword = 'SecurePassword123!';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(rawPassword, salt);

    expect(hash).not.toBe(rawPassword);
    expect(hash.startsWith('$2')).toBe(true);

    const isMatch = await bcrypt.compare(rawPassword, hash);
    expect(isMatch).toBe(true);

    const isMismatch = await bcrypt.compare('WrongPassword456!', hash);
    expect(isMismatch).toBe(false);
  });

  it('Validates signup schema and rejects invalid inputs', () => {
    // Valid signup data
    const valid = signupSchema.safeParse({
      fullName: 'Piyush Sharma',
      email: 'student@example.ac.in',
      password: 'Password123!',
      academicDetails: {
        institution: 'NIT Nagpur',
        course: 'B.Tech CSE',
      },
    });
    expect(valid.success).toBe(true);

    // Short password (< 8 chars)
    const invalidPassword = signupSchema.safeParse({
      fullName: 'Piyush Sharma',
      email: 'student@example.ac.in',
      password: 'short',
    });
    expect(invalidPassword.success).toBe(false);

    // Invalid email format
    const invalidEmail = signupSchema.safeParse({
      fullName: 'Piyush Sharma',
      email: 'not-an-email',
      password: 'Password123!',
    });
    expect(invalidEmail.success).toBe(false);

    // Missing full name
    const missingName = signupSchema.safeParse({
      email: 'student@example.ac.in',
      password: 'Password123!',
    });
    expect(missingName.success).toBe(false);
  });

  it('Validates login schema correctly', () => {
    const valid = loginSchema.safeParse({
      email: 'STUDENT@EXAMPLE.AC.IN',
      password: 'Password123!',
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.email).toBe('student@example.ac.in'); // Lowercased
    }

    const invalid = loginSchema.safeParse({
      email: 'bad-email',
      password: '',
    });
    expect(invalid.success).toBe(false);
  });

  it('Signs and verifies JWT with correct claims', () => {
    const payload = {
      userId: 'user_123456',
      email: 'student@example.ac.in',
    };

    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
    expect(typeof token).toBe('string');

    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    expect(decoded.userId).toBe('user_123456');
    expect(decoded.email).toBe('student@example.ac.in');

    // Tampered token fails verification
    expect(() => jwt.verify(token + 'tampered', env.JWT_SECRET)).toThrow();
  });
});

