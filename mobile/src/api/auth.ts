import { apiClient, API_ORIGIN } from "./client";

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
  photo?: string | null;
  date_joined?: string;
}

/** Departments and years the server accepts (accounts.models Department / ProgramYear). */
export const DEPARTMENTS = [
  { value: "CSE", label: "Computer Science & Engineering" },
  { value: "ECE", label: "Electrical & Communication Engineering" },
  { value: "ME", label: "Mechanical Engineering" },
  { value: "CE", label: "Civil Engineering" },
  { value: "MATHS", label: "Mathematics" },
  { value: "PHYSICS", label: "Physics" },
  { value: "CHEMISTRY", label: "Chemistry" },
  { value: "HSS", label: "Humanities & Social Sciences" },
  { value: "OTHER", label: "Other" },
];

export const PROGRAM_YEARS = [
  { value: "BTECH_1", label: "B.Tech 1st year" },
  { value: "BTECH_2", label: "B.Tech 2nd year" },
  { value: "BTECH_3", label: "B.Tech 3rd year" },
  { value: "BTECH_4", label: "B.Tech 4th year" },
  { value: "MTECH_1", label: "M.Tech 1st year" },
  { value: "MTECH_2", label: "M.Tech 2nd year" },
  { value: "PHD", label: "Ph.D" },
  { value: "FACULTY", label: "Faculty / Staff" },
];

export function departmentLabel(value?: string): string {
  return DEPARTMENTS.find((d) => d.value === value)?.label || value || "";
}

export function programYearLabel(value?: string): string {
  return PROGRAM_YEARS.find((p) => p.value === value)?.label || value || "";
}

/** The profile photo as a full URL (the API may send a path on its own host). */
export function profilePhotoUrl(user?: UserProfile | null): string | null {
  const photo = user?.photo;
  if (!photo) return null;
  return photo.startsWith("/") && !photo.startsWith("//") ? `${API_ORIGIN}${photo}` : photo;
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

  async logout(refresh: string) {
    const res = await apiClient.post("/auth/logout/", { refresh });
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

  /** Change the editable profile fields; a photo goes up as multipart. */
  async updateProfile(
    changes: Partial<Pick<UserProfile, "full_name" | "department" | "program_year" | "hostel" | "phone">>,
    photo?: { uri: string; name: string; type: string } | null
  ): Promise<UserProfile> {
    if (photo) {
      const form = new FormData();
      Object.entries(changes).forEach(([key, value]) => form.append(key, String(value ?? "")));
      form.append("photo", photo as any);
      const res = await apiClient.patch("/users/me/", form, { headers: { "Content-Type": "multipart/form-data" } });
      return res.data?.data || res.data;
    }
    const res = await apiClient.patch("/users/me/", changes);
    return res.data?.data || res.data;
  },

  async resetPassword(data: { email: string; otp_code?: string; code?: string; new_password: string }) {
    const code = data.code || data.otp_code || "";
    const payload = {
      email: data.email,
      code,
      otp_code: code,
      new_password: data.new_password,
    };
    try {
      const res = await apiClient.post("/auth/password-reset-confirm/", payload);
      return res.data;
    } catch {
      const res = await apiClient.post("/auth/password-reset/", payload);
      return res.data;
    }
  },
};
