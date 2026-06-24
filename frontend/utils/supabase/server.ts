import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component; proxy refreshes sessions.
        }
      },
    },
  });
};

/**
 * Resolve the signed-in user id from the session cookie (no network round-trip).
 * Falls back through getClaims when the session cookie is not yet hydrated.
 */
export async function getAuthUserId(): Promise<string | null> {
  const supabase = await createClient();

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return session.user.id;
    }
  } catch {
    // continue to claims fallback
  }

  try {
    const { data, error } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!error && typeof userId === "string" && userId) {
      return userId;
    }
  } catch {
    // Supabase Auth unreachable — session cookie path above is preferred
  }

  return null;
}
