import { NextResponse } from "next/server";
import { notifyAdminsNewApplication } from "@/app/actions/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type, createdAt } = body;

    if (!name || !type || !createdAt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await notifyAdminsNewApplication({ name, type, createdAt });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in notify-application route:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
