// Kiểm tra MX của domain email (không gửi thử SMTP — mục 4.4).
export type MxStatus = "ok" | "a_only" | "none" | "unknown";

/** MX của domain, tối đa timeoutMs (DNS treo thì trả "unknown" thay vì giữ cả lượt chạy). */
export function mxStatus(domain: string, timeoutMs = 3000): Promise<MxStatus> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<MxStatus>((resolve) => {
    timer = setTimeout(() => resolve("unknown"), timeoutMs);
  });
  return Promise.race([lookupMx(domain), timeout]).finally(() => clearTimeout(timer));
}

async function lookupMx(domain: string): Promise<MxStatus> {
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
