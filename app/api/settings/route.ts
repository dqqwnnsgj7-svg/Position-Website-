import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, calendarPreference: true },
  });

  return NextResponse.json(user);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();
  const updateData: Record<string, string | null> = {};

  if (data.name !== undefined) updateData.name = data.name || null;
  if (data.calendarPreference !== undefined) updateData.calendarPreference = data.calendarPreference || null;

  if (data.currentPassword && data.newPassword) {
    if (data.newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    const valid = await bcrypt.compare(data.currentPassword, user.password);
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    updateData.password = await bcrypt.hash(data.newPassword, 12);
  }

  await prisma.user.update({ where: { id: session.user.id }, data: updateData });
  return NextResponse.json({ success: true });
}
