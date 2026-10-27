import { apiClient } from "./client";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  registration_number: string;
  phone?: string;
  department?: string;
  program_year?: string;
  hostel?: string;
  is_staff?: boolean;
  avatar_url?: string;
}

export const authApi = {
  async requestOtp(email: string, purpose: "registration" | "password_reset" = "registration") {
    const res = await apiClient.post("/auth/request-otp/", { email, purpose });
    return res.data;
  },

  async verifyOtp(email: string, code: string, purpose: "registration" | "password_reset" = "registration") {
    const res = await apiClient.post("/auth/verify-otp/", { email, code, purpose });
    return res.data;
  },

  async register(data: {
    email: string;
    password: string;
    full_name: string;
    registration_number: string;
    department: string;
    program_year: string;
    hostel?: string;
    phone?: string;
  }) {
    const res = await apiClient.post("/auth/register/", data);
    return res.data;
  },

  async login(email: string, password: string) {
    const res = await apiClient.post("/auth/login/", { email, password });
    return res.data;
  },

  async getProfile(): Promise<UserProfile> {
    try {
      const res = await apiClient.get("/users/me/");
      return res.data?.data || res.data;
    } catch {
      const res = await apiClient.get("/auth/profile/");
      return res.data?.data || res.data;
    }
  },

  async resetPassword(data: { email: string; otp_code: string; new_password: string }) {
    const res = await apiClient.post("/auth/password-reset/", data);
    return res.data;
  },
};
