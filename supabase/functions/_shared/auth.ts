// Xác thực người gọi: JWT đã được gateway kiểm tra (verify_jwt = true); ở đây lấy user
// và vai trò từ bảng profiles — không tin bất kỳ vai trò nào do client gửi lên (mục 10.2).
import { HttpError } from "./http.ts";
import { type Db, serviceClient } from "./db.ts";

export interface AuthContext {
  userId: string;
  email: string | null;
  role: "admin" | "user";
  isAdmin: boolean;
  db: Db;
}

export async function requireUser(req: Request): Promise<AuthContext> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "Chưa đăng nhập", "unauthorized");
  const db = serviceClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "Phiên đăng nhập không hợp lệ", "unauthorized");
  const { data: profile } = await db.from("profiles").select("role").eq("user_id", data.user.id).maybeSingle();
  if (!profile) throw new HttpError(403, "Tài khoản chưa được cấp quyền", "forbidden");
  const role = profile.role === "admin" ? "admin" : "user";
  return { userId: data.user.id, email: data.user.email ?? null, role, isAdmin: role === "admin", db };
}

export async function requireAdmin(req: Request): Promise<AuthContext> {
  const ctx = await requireUser(req);
  if (!ctx.isAdmin) throw new HttpError(403, "Chỉ admin được thực hiện thao tác này", "forbidden");
  return ctx;
}
