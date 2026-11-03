// Empty base URL = same origin (production: Express serves the UI and the API).
export const API_URL = import.meta.env.VITE_API_URL ?? "";

export async function getHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}
