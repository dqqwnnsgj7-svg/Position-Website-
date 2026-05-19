import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success even if user doesn't exist (security best practice)
    if (!user) return NextResponse.json({ success: true });

    // Delete any existing tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

    // In production, send this via email service (Resend, SendGrid, etc.)
    // For now, we return the URL in development so you can test the flow
    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json({ success: true, ...(isDev && { resetUrl }) });
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
