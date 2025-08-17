export interface JwtPayload {
  sub: string;
  phone: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}