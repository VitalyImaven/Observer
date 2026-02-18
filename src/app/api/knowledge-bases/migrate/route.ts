import { NextResponse } from "next/server";
import {
  getKnowledgeBases,
  saveKnowledgeBases,
  getKnowledgeFiles,
  saveKnowledgeFiles,
  getKnowledgeChunks,
  saveKnowledgeChunks,
} from "@/lib/store";
import { v4 as uuidv4 } from "uuid";

export async function POST() {
  const bases = getKnowledgeBases();
  const files = getKnowledgeFiles();
  const chunks = getKnowledgeChunks();

  // Find files without a KB assignment
  const orphanFiles = files.filter((f) => !f.knowledgeBaseId);
  if (orphanFiles.length === 0) {
    return NextResponse.json({
      message: "No files to migrate",
      migrated: 0,
    });
  }

  // Create a default KB if it doesn't exist
  let defaultKb = bases.find((b) => b.name === "VC Meeting");
  if (!defaultKb) {
    defaultKb = {
      id: uuidv4(),
      name: "VC Meeting",
      createdAt: new Date().toISOString(),
    };
    bases.push(defaultKb);
    saveKnowledgeBases(bases);
  }

  // Assign orphan files to the default KB
  let migratedCount = 0;
  for (const f of files) {
    if (!f.knowledgeBaseId) {
      f.knowledgeBaseId = defaultKb.id;
      migratedCount++;
    }
  }
  saveKnowledgeFiles(files);

  // Assign orphan chunks
  const orphanFileIds = new Set(orphanFiles.map((f) => f.id));
  for (const c of chunks) {
    if (!c.knowledgeBaseId && orphanFileIds.has(c.fileId)) {
      c.knowledgeBaseId = defaultKb.id;
    }
  }
  saveKnowledgeChunks(chunks);

  console.log(`[MIGRATE] Moved ${migratedCount} files to KB "${defaultKb.name}" (${defaultKb.id})`);

  return NextResponse.json({
    message: `Migrated ${migratedCount} files to "${defaultKb.name}"`,
    migrated: migratedCount,
    knowledgeBaseId: defaultKb.id,
  });
}
