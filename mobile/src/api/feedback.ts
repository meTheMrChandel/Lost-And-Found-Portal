import { apiClient } from "./client";

export async function sendFeedback(feedback: {
  rating: number;
  message: string;
  page?: string;
}): Promise<{ success?: boolean; message?: string }> {
  const res = await apiClient.post("/feedback/", feedback);
  return res.data;
}
