import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const t = nodemailer.createTransport({host:b.host, port:Number(b.port), secure:Number(b.port)===465, auth:{user:b.user, pass:b.pass}});
    await t.verify();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
