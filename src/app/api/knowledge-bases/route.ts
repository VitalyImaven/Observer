import { NextResponse } from "next/server";
import { getKnowledgeBases, saveKnowledgeBases } from "@/lib/store";
import type { KnowledgeBase } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  return NextResponse.json(getKnowledgeBases());
}

export async function POST(request: Request) {
  const { name } = await request.json();
  const bases = getKnowledgeBases();

  const newBase: KnowledgeBase = {
    id: uuidv4(),
    name: name || "Untitled",
    createdAt: new Date().toISOString(),
  };

  bases.push(newBase);
  saveKnowledgeBases(bases);
  return NextResponse.json(newBase);
}

export async function PUT(request: Request) {
  const { id, name } = await request.json();
  const bases = getKnowledgeBases();
  const index = bases.findIndex((b) => b.id === id);
  if (index === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  bases[index].name = name;
  saveKnowledgeBases(bases);
  return NextResponse.json(bases[index]);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }
  let bases = getKnowledgeBases();
  bases = bases.filter((b) => b.id !== id);
  saveKnowledgeBases(bases);
  return NextResponse.json({ success: true });
}
