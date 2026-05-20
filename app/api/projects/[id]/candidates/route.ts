export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseFile, parsePdf } from '@/lib/parseFile';
import { evaluateCandidate, splitResumes } from '@/lib/evaluate';

async function withConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const pool = new Set<Promise<void>>();
  for (let i = 0; i < items.length; i++) {
    const idx = i;
    const task = fn(items[i]).then(r => { results[idx] = r; });
    const entry: Promise<void> = task.finally(() => pool.delete(entry));
    pool.add(entry);
    if (pool.size >= limit) await Promise.race(pool);
  }
  await Promise.all(pool);
  return results;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

  if (!project.description) {
    return NextResponse.json({ error: 'Please add a job description before uploading resumes.' }, { status: 400 });
  }

  const formData = await req.formData();
  const files = formData.getAll('resumes') as File[];

  if (!files.length) return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });

  const perFile = await withConcurrency(files, 3, async (file) => {
    const fileResults: { success?: boolean; candidateId?: string; name?: string; fileName?: string; error?: string; duplicate?: boolean }[] = [];
    try {
      const existing = await prisma.candidate.findFirst({
        where: { projectId: params.id, fileName: file.name, deletedAt: null },
      });
      if (existing) {
        fileResults.push({ fileName: file.name, duplicate: true });
        return fileResults;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileDataBase64 = buffer.toString('base64');
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

      let resumeTexts: string[];
      if (isPdf) {
        const { text, numPages } = await parsePdf(buffer);
        resumeTexts = numPages >= 2 ? await splitResumes(text) : [text];
      } else {
        const text = await parseFile(buffer, file.type, file.name);
        // Try splitting if the document is long enough to contain more than one resume
        const lineCount = text.split('\n').length;
        resumeTexts = lineCount >= 50 ? await splitResumes(text) : [text];
      }

      const isMulti = resumeTexts.length > 1;

      for (let i = 0; i < resumeTexts.length; i++) {
        const resumeText = resumeTexts[i].trim() || `[File: ${file.name}]`;
        const entryName = isMulti ? `${file.name} — Resume ${i + 1}` : file.name;

        if (isMulti) {
          const subExisting = await prisma.candidate.findFirst({
            where: { projectId: params.id, fileName: entryName, deletedAt: null },
          });
          if (subExisting) { fileResults.push({ fileName: entryName, duplicate: true }); continue; }
        }

        try {
          const evaluation = await evaluateCandidate(
            resumeText,
            project.description!,
            project.title,
            project.customCriteria
          );
          const label = evaluation.score >= project.threshold ? 'good' : 'poor';
          const candidate = await prisma.candidate.create({
            data: {
              name: evaluation.name,
              email: evaluation.email,
              fileName: entryName,
              fileMimeType: file.type || null,
              fileData: fileDataBase64,
              resumeText,
              score: evaluation.score,
              pros: JSON.stringify(evaluation.pros),
              cons: JSON.stringify(evaluation.cons),
              analysis: evaluation.analysis,
              interviewQuestions: JSON.stringify(evaluation.interviewQuestions),
              label,
              rejectionEmail: evaluation.rejectionEmail,
              acceptanceMessage: evaluation.acceptanceMessage,
              projectId: params.id,
              evaluatedAt: new Date(),
            },
          });
          fileResults.push({ success: true, candidateId: candidate.id, name: evaluation.name || entryName });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.error(`[evaluate] ${entryName}:`, msg);
          fileResults.push({ fileName: entryName, error: `Failed to evaluate: ${msg}` });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      fileResults.push({ fileName: file.name, error: `Failed to evaluate: ${msg}` });
    }
    return fileResults;
  });

  const results = perFile.flat();
  return NextResponse.json({ results }, { status: 201 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

  const { count } = await prisma.candidate.updateMany({
    where: { projectId: params.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ deleted: count });
}
