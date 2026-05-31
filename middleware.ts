// middleware.ts — sits at the project root
// Protects the entire dashboard with a simple password via Basic Auth
// Set DASHBOARD_PASSWORD in your Vercel env vars to enable
// Leave it blank/unset to disable (open access)

import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const pw = process.env.DASHBOARD_PASSWORD;

  // If no password set, allow through
  if (!pw) return NextResponse.next();

  const auth = req.headers.get("authorization");

  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      const [, password] = decoded.split(":");
      if (password === pw) return NextResponse.next();
    }
  }

  // Prompt browser for password
  return new NextResponse("Unauthorised", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Legitstar Sales Dashboard"',
    },
  });
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"],
};
