// Kiểm tra MX của domain email (không gửi thử SMTP — mục 4.4).
export type MxStatus = "ok" | "a_only" | "none" | "unknown";

export async function mxStatus(domain: string): Promise<MxStatus> {
  // deno-lint-ignore no-explicit-any
  const resolveDns = (globalThis as any).Deno?.resolveDns as ((d: string, t: string) => Promise<unknown[]>) | undefined;
  if (typeof resolveDns !== "function") return "unknown";
  const has = async (type: string): Promise<boolean | null> => {
    try {
      return (await resolveDns(domain, type)).length > 0;
    } catch (e) {
      return (e as Error)?.name === "NotFound" ? false : null;
    }
  };
  const mx = await has("MX");
  if (mx) return "ok";
  const a = await has("A");
  if (mx === false && a) return "a_only";
  if (mx === false && a === false) return "none";
  return "unknown";
}
