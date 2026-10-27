import { ApiService, USE_MOCKS, simulateLatency } from './api.ts';
import type { UserProfile, LoginCredentials, SignupData, AuthSession } from '../types/auth.ts';
import { mockUserProfile } from '../mocks/data/user.mock.ts';

class AuthService {
  private currentUser: UserProfile | null = USE_MOCKS ? mockUserProfile : null;

  public async getCurrentUser(): Promise<UserProfile | null> {
    if (USE_MOCKS) {
      await simulateLatency(150);
      return this.currentUser;
    }

    try {
      const user = await ApiService.request<UserProfile>('/api/auth/me');
      this.currentUser = user;
      return user;
    } catch {
      this.currentUser = null;
      ApiService.setAuthToken(null);
      return null;
    }
  }

  public async login(credentials: LoginCredentials): Promise<AuthSession> {
    if (USE_MOCKS) {
      await simulateLatency(300);
      this.currentUser = {
        ...mockUserProfile,
        email: credentials.email,
      };
      const session: AuthSession = {
        token: 'mock_jwt_token_saarthi_xyz',
        user: this.currentUser,
      };
      ApiService.setAuthToken(session.token);
      return session;
    }

    const session = await ApiService.request<AuthSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    ApiService.setAuthToken(session.token);
    this.currentUser = session.user;
    return session;
  }

  public async signup(data: SignupData): Promise<AuthSession> {
    if (USE_MOCKS) {
      await simulateLatency(350);
      this.currentUser = {
        ...mockUserProfile,
        fullName: data.fullName,
        email: data.email,
        academicDetails: {
          ...mockUserProfile.academicDetails,
          institution: data.institution,
          course: data.course,
        },
      };
      const session: AuthSession = {
        token: 'mock_jwt_token_saarthi_new',
        user: this.currentUser,
      };
      ApiService.setAuthToken(session.token);
      return session;
    }

    const session = await ApiService.request<AuthSession>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    ApiService.setAuthToken(session.token);
    this.currentUser = session.user;
    return session;
  }

  public async logout(): Promise<void> {
    if (USE_MOCKS) {
      await simulateLatency(100);
      this.currentUser = null;
      ApiService.setAuthToken(null);
      return;
    }

    try {
      await ApiService.request<void>('/api/auth/logout', { method: 'POST' });
    } finally {
      ApiService.setAuthToken(null);
      this.currentUser = null;
    }
  }
}

export const authService = new AuthService();
