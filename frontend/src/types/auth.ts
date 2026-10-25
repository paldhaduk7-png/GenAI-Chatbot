/**
 * Authentication TypeScript definitions matching FastAPI backend schemas.
 * Strictly avoids exposing passwords or password hashes.
 */

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}
