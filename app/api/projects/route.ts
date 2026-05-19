import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      include: {
        candidates: {
          where: { deletedAt: null },
          select: { id: true, name: true, status: true, score: true, label: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(projects);
  } catch (err) {
    console.error('[GET projects]', err);
    return NextResponse.json({ error: 'Failed to load projects.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, description, threshold, interviewTarget, openSlots, customCriteria } = await req.json();
  if (!title) return NextResponse.json({ error: 'Job title is required.' }, { status: 400 });

  const project = await prisma.project.create({
    data: {
      title,
      description: description || null,
      threshold: threshold ?? 70,
      interviewTarget: interviewTarget || null,
      openSlots: openSlots ?? 1,
      customCriteria: customCriteria || null,
      userId: session.user.id,
    },
  });

  return NextResponse.json(project, { status: 201 });
}
