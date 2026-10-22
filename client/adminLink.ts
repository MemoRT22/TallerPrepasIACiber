import type { Session } from "../shared/types";

export type AdminLink = { access: string } | { session: Session };
export function readAdminFragment(fragment: string): AdminLink | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const access = params.get("access");
  if (access && access.length <= 256 && /^[A-Za-z0-9_-]+$/.test(access))
    return { access };
  const code = params.get("room"),
    token = params.get("token");
  if (
    code &&
    /^\d{4}$/.test(code) &&
    token &&
    token.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(token)
  )
    return { session: { code, token, kind: "admin" } };
  return null;
}
export function parseAdminLink(
  value: string,
  origin: string,
): AdminLink | null {
  try {
    const url = new URL(value.trim());
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.origin !== origin ||
      url.username ||
      url.password ||
      url.pathname.replace(/\/$/, "") !== "/docente"
    )
      return null;
    return readAdminFragment(url.hash);
  } catch {
    return null;
  }
}

export function rememberAdminLink(link: AdminLink): boolean {
  try {
    if ("access" in link)
      sessionStorage.setItem("cancun:operator", link.access);
    else
      localStorage.setItem(
        "cancun:admin:session",
        JSON.stringify(link.session),
      );
    return true;
  } catch {
    return false;
  }
}
export function removeAdminFragment() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  for (const key of ["access", "room", "token"]) params.delete(key);
  const hash = params.toString();
  history.replaceState(
    null,
    "",
    location.pathname + location.search + (hash ? "#" + hash : ""),
  );
}

export function retainAdminFragment(link: AdminLink) {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  for (const key of ["access", "room", "token"]) params.delete(key);
  if ("access" in link) params.set("access", link.access);
  else {
    params.set("room", link.session.code);
    params.set("token", link.session.token);
  }
  history.replaceState(
    null,
    "",
    location.pathname + location.search + "#" + params.toString(),
  );
}
