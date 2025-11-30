import { API_BASE } from "../constants.js";

export async function uploadFileToServer(file) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error("파일 업로드 실패: " + (err.error || "unknown"));
  }

  return res.json();
}
