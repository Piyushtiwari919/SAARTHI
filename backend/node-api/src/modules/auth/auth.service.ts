import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel, IUser } from './user.model.js';
import { SignupInput, LoginInput } from './auth.validation.js';
import { env } from '../../config/env.js';

export interface AuthResult {
  token: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    academicDetails: IUser['academicDetails'];
    privacyConsent: IUser['privacyConsent'];
    createdAt: Date;
    updatedAt: Date;
  };
}

export class AuthService {
  public static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  public static async comparePassword(candidate: string, hash: string): Promise<boolean> {
    return bcrypt.compare(candidate, hash);
  }

  public static generateToken(userId: string): string {
    return jwt.sign({ sub: userId }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  public static async signup(input: SignupInput): Promise<AuthResult> {
    const existing = await UserModel.findOne({ email: input.email });
    if (existing) {
      const err = new Error('An account with this email address already exists');
      (err as unknown as { statusCode: number }).statusCode = 409;
      throw err;
    }

    const passwordHash = await this.hashPassword(input.password);

    const user = await UserModel.create({
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      academicDetails: {
        institution: input.institution || '',
        course: input.course || '',
        currentYear: 1,
        totalYears: 4,
        academicStream: '',
      },
      privacyConsent: {
        acceptedAt: new Date(),
        dataRetentionDays: 365,
        shareWithInstitutions: false,
      },
    });

    const token = this.generateToken(user.id);

    return {
      token,
      user: user.toJSON() as unknown as AuthResult['user'],
    };
  }

  public static async login(input: LoginInput): Promise<AuthResult> {
    const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
    if (!user) {
      const err = new Error('Invalid email or password');
      (err as unknown as { statusCode: number }).statusCode = 401;
      throw err;
    }

    const valid = await this.comparePassword(input.password, user.passwordHash);
    if (!valid) {
      const err = new Error('Invalid email or password');
      (err as unknown as { statusCode: number }).statusCode = 401;
      throw err;
    }

    const token = this.generateToken(user.id);

    return {
      token,
      user: user.toJSON() as unknown as AuthResult['user'],
    };
  }

  public static async getUserById(userId: string): Promise<AuthResult['user'] | null> {
    const user = await UserModel.findById(userId);
    return user ? (user.toJSON() as unknown as AuthResult['user']) : null;
  }
}

