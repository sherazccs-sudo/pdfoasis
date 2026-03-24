import { NextResponse } from "next/server";

export async function GET() {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";

  let backendStatus: "ok" | "unreachable" = "unreachable";
  let backendInfo: Record<string, unknown> = {};

  try {
    const res = await fetch(`${backendUrl}/health`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      backendStatus = "ok";
      backendInfo = await res.json();
    }
  } catch {
    // backend unreachable — surface in response but don't throw
  }

  return NextResponse.json({
    status: "ok",
    service: "pdfoasis-frontend",
    timestamp: new Date().toISOString(),
    backend: {
      status: backendStatus,
      url: backendUrl,
      ...backendInfo,
    },
  });
}
