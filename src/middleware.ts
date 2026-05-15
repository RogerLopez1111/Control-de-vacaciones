import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * - Refresca la sesión de Supabase en cada request.
 * - Redirige a /login si no hay sesión.
 * - Fuerza /cambiar-contrasena si el usuario aún tiene la contraseña default
 *   (user_metadata.password_default === true). Ese flag se baja en el flujo
 *   de cambio de contraseña.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet: CookieToSet[]) {
          toSet.forEach(({ name, value }: CookieToSet) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }: CookieToSet) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isLogin = path.startsWith("/login");
  const isPwChange = path.startsWith("/cambiar-contrasena");

  if (!user) {
    if (isLogin) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Está autenticado. Si todavía usa la contraseña default, forzar cambio.
  const isDefaultPassword = user.user_metadata?.password_default === true;
  if (isDefaultPassword && !isPwChange) {
    const url = request.nextUrl.clone();
    url.pathname = "/cambiar-contrasena";
    return NextResponse.redirect(url);
  }

  // Autenticado y con contraseña real: si pisa /login o /cambiar-contrasena, mándalo al dashboard.
  if (isLogin || (isPwChange && !isDefaultPassword)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
