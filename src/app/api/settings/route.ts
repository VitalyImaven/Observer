import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/store";
import type { AppSettings } from "@/types";

export async function GET() {
  const settings = getSettings();
  const masked = {
    ...settings,
    openaiApiKey: settings.openaiApiKey
      ? "sk-..." + settings.openaiApiKey.slice(-4)
      : "",
  };
  return NextResponse.json(masked);
}

export async function PUT(request: Request) {
  const body: Partial<AppSettings> = await request.json();
  const current = getSettings();
  const updated = { ...current, ...body };
  saveSettings(updated);
  return NextResponse.json({ success: true });
}
