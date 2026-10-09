export interface User {
  id: string;
  email: string;
  registration_number: string;
  full_name: string;
  department: string;
  program_year: string;
  hostel?: string;
  phone?: string;
  role: "admin" | "user";
  is_staff: boolean;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  access?: string;
  refresh?: string;
  errors?: Record<string, string[]>;
}
