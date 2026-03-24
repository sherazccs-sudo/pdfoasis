/**
 * API client for the PDFOasis backend.
 *
 * The backend URL is resolved in priority order:
 *   1. NEXT_PUBLIC_BACKEND_URL  (set at build time / runtime via Railway env)
 *   2. http://localhost:5000    (local development fallback)
 *
 * On Railway, set NEXT_PUBLIC_BACKEND_URL to the internal service URL:
 *   http://pdfoasis-backend.railway.internal:5000
 * or the public domain if the services are in different projects.
 */

export type ConvertFormat = "pdf-to-word" | "pdf-to-image" | "pdf-to-text" | "compress";

export interface ApiResult {
  downloadUrl: string;
  filename: string;
  message?: string;
}

function getBackendUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ??
    "http://localhost:5000"
  );
}

/**
 * Convert a single PDF to the requested format.
 */
export async function convertPdf(
  file: File,
  format: ConvertFormat
): Promise<ApiResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("format", format);

  const res = await fetch(`${getBackendUrl()}/api/convert`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ??
        `Conversion failed (HTTP ${res.status})`
    );
  }

  const data = (await res.json()) as ApiResult;
  // Resolve relative download URLs against the backend origin
  if (data.downloadUrl && !data.downloadUrl.startsWith("http")) {
    data.downloadUrl = `${getBackendUrl()}${data.downloadUrl}`;
  }
  return data;
}

/**
 * Merge multiple PDFs into one.
 */
export async function mergePdfs(files: File[]): Promise<ApiResult> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));

  const res = await fetch(`${getBackendUrl()}/api/merge`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ??
        `Merge failed (HTTP ${res.status})`
    );
  }

  const data = (await res.json()) as ApiResult;
  if (data.downloadUrl && !data.downloadUrl.startsWith("http")) {
    data.downloadUrl = `${getBackendUrl()}${data.downloadUrl}`;
  }
  return data;
}

/**
 * Poll the status of a long-running conversion job.
 */
export async function getJobStatus(
  jobId: string
): Promise<{ id: string; status: string; result?: ApiResult }> {
  const res = await fetch(`${getBackendUrl()}/api/status/${jobId}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ??
        `Status check failed (HTTP ${res.status})`
    );
  }

  return res.json();
}
