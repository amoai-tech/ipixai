import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "sign_out_failed" }, { status: 500 });
  }
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    return NextResponse.json({ error: "sign_out_failed" }, { status: 500 });
  }
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
