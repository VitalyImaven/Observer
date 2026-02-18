import { NextResponse } from "next/server";
import { getDirectives, saveDirectives } from "@/lib/store";
import type { Directive } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const directives = getDirectives();
  return NextResponse.json(directives);
}

export async function POST(request: Request) {
  const body = await request.json();
  const directives = getDirectives();
  const now = new Date().toISOString();
  const newDirective: Directive = {
    id: uuidv4(),
    name: body.name || "Untitled Directive",
    content: body.content || "",
    knowledgeBaseId: body.knowledgeBaseId || null,
    createdAt: now,
    updatedAt: now,
  };
  directives.push(newDirective);
  saveDirectives(directives);
  return NextResponse.json(newDirective);
}

export async function PUT(request: Request) {
  const body = await request.json();
  const directives = getDirectives();
  const index = directives.findIndex((d) => d.id === body.id);
  if (index === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  directives[index] = {
    ...directives[index],
    name: body.name ?? directives[index].name,
    content: body.content ?? directives[index].content,
    knowledgeBaseId: body.knowledgeBaseId !== undefined ? body.knowledgeBaseId : directives[index].knowledgeBaseId,
    updatedAt: new Date().toISOString(),
  };
  saveDirectives(directives);
  return NextResponse.json(directives[index]);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }
  let directives = getDirectives();
  directives = directives.filter((d) => d.id !== id);
  saveDirectives(directives);
  return NextResponse.json({ success: true });
}
