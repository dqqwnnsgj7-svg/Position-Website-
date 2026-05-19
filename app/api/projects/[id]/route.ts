import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Explicit candidate field list — excludes fileData (served separately via /file)
const CANDIDATE_SELECT = {
  id: true,
  name: true,
  email: true,
  fileName: true,
  fileMimeType: true,
  score: true,
  pros: true,
  cons: true,
  analysis: true,
  interviewQuestions: true,
  label: true,
  status: true,
  cultureNotes: true,
  rejectionEmail: true,
  acceptanceMessage: true,
  projectId: true,
  createdAt: true,
  evaluatedAt: true,
} as const;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const project = await prisma.project.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: {
        candidates: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: CANDIDATE_SELECT,
        },
      },
    });

    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    return NextResponse.json(project);
  } catch (err) {
    console.error('[GET project]', err);
    return NextResponse.json({ error: 'Something went wrong loading this project.' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await req.json();
    const project = await prisma.project.updateMany({
      where: { id: params.id, userId: session.user.id },
      data: {
        title: data.title,
        description: data.description,
        threshold: data.threshold,
        interviewTarget: data.interviewTarget,
        openSlots: data.openSlots,
        customCriteria: data.customCriteria,
      },
    });

    if (!project.count) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PATCH project]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.project.deleteMany({ where: { id: params.id, userId: session.user.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE project]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
