// Danh sách loại trừ (DNC) — được tôn trọng ở mọi bước (mục 10.6 #5).
import { type Db, must } from "./db.ts";

export interface DncList {
  isDomain(domain: string | null | undefined): boolean;
  isEmail(email: string | null | undefined): boolean;
}

export function makeDnc(rows: { kind: string; value: string }[]): DncList {
  const domains = rows.filter((r) => r.kind === "domain").map((r) => r.value.toLowerCase());
  const emails = new Set(rows.filter((r) => r.kind === "email").map((r) => r.value.toLowerCase()));
  const isDomain = (d: string | null | undefined) => {
    if (!d) return false;
    const h = d.toLowerCase();
    return domains.some((v) => h === v || h.endsWith("." + v));
  };
  return {
    isDomain,
    isEmail(email) {
      if (!email) return false;
      const e = email.trim().toLowerCase();
      return emails.has(e) || isDomain(e.split("@")[1]);
    },
  };
}

export async function loadDnc(db: Db): Promise<DncList> {
  const rows = must(await db.from("do_not_contact").select("kind, value"), "Đọc DNC") as { kind: string; value: string }[];
  return makeDnc(rows);
}
