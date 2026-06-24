import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    });

    // Read session from cookies only — avoids a network call to Supabase Auth on
    // every request (getUser() can block ~10s and fail with ConnectTimeoutError).
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { pathname } = request.nextUrl;

    if (!session?.user && pathname.startsWith("/dashboard")) {
      const url = request.nextUrl.clone();
      url.pathname = "/signin";
      const redirectResponse = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
        redirectResponse.cookies.set(name, value);
      });
      return redirectResponse;
    }

    return supabaseResponse;
  } catch {
    return supabaseResponse;
  }
}
