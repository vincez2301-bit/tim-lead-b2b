// keepalive — GitHub Actions gọi mỗi ngày để project Supabase gói Free không bị tạm dừng vì 7 ngày không hoạt động.
// Không cần JWT (verify_jwt = false), không nhận input, không trả dữ liệu nào ngoài thời điểm ghi heartbeat.
import { json, serve } from "../_shared/http.ts";
import { must, serviceClient } from "../_shared/db.ts";

serve(async () => {
  const at = must(await serviceClient().rpc("keepalive"), "Ghi heartbeat") as string;
  return json({ ok: true, at });
});
