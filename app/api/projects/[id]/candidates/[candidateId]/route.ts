import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Verify the project belongs to the current user, then fetch the candidate.
// Kept as two separate queries to avoid Prisma/SQLite issues with nested
// relation filters combined with `select`.

export async function GET(_req: Request, { params }: { params: { id: string; candidateId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findFirst({
      where: { id: params.id, userId: session.user.id },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    const candidate = await prisma.candidate.findFirst({
      where: { id: params.candidateId, projectId: params.id },
    });
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 });
    }

    // Strip the raw file blob — it's served via the /file endpoint instead
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fileData: _fd, ...safe } = candidate;
    return NextResponse.json(safe);
  } catch (err) {
    console.error('[GET candidate]', err);
    return NextResponse.json(
      { error: 'Something went wrong loading this candidate.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string; candidateId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findFirst({
      where: { id: params.id, userId: session.user.id },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    const exists = await prisma.candidate.findFirst({
      where: { id: params.candidateId, projectId: params.id },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 });
    }

    const data = await req.json();
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.label !== undefined) updateData.label = data.label;
    if (data.cultureNotes !== undefined) updateData.cultureNotes = data.cultureNotes;

    const candidate = await prisma.candidate.update({
      where: { id: params.candidateId },
      data: updateData,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fileData: _fd, ...safe } = candidate;
    return NextResponse.json(safe);
  } catch (err) {
    console.error('[PATCH candidate]', err);
    return NextResponse.json(
      { error: 'Something went wrong updating this candidate.' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; candidateId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findFirst({
      where: { id: params.id, userId: session.user.id },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    const exists = await prisma.candidate.findFirst({
      where: { id: params.candidateId, projectId: params.id },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 });
    }

    await prisma.candidate.update({
      where: { id: params.candidateId },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE candidate]', err);
    return NextResponse.json(
      { error: 'Something went wrong deleting this candidate.' },
      { status: 500 }
    );
  }
}
