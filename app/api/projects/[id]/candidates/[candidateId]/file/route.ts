import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: { id: string; candidateId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

  const candidate = await prisma.candidate.findFirst({
    where: { id: params.candidateId, projectId: params.id },
    select: { fileData: true, fileMimeType: true, fileName: true },
  });

  if (!candidate) return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 });

  if (!candidate.fileData) {
    return new NextResponse('Resume file not available for this candidate.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const buffer = Buffer.from(candidate.fileData, 'base64');
  const contentType = candidate.fileMimeType || 'application/octet-stream';

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${candidate.fileName}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
