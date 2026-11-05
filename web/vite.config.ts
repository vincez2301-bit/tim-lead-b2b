import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Mục 10.3: Content-Security-Policy chặt cho bản build production.
// Chỉ chèn khi build (dev server của Vite cần script inline cho HMR).
function cspPlugin(supabaseUrl: string): Plugin {
  let connect = "'self'";
  if (supabaseUrl) {
    const u = new URL(supabaseUrl);
    connect += ` ${u.origin} wss://${u.host}`;
  }
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "media-src 'self' https://audiocdn.epidemicsound.com",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
  return {
    name: "slf-csp",
    apply: "build",
    transformIndexHtml(html) {
      // Đặt ngay sau thẻ charset để CSP có hiệu lực trước mọi tài nguyên khác.
      return html.replace(
        /<meta charset="UTF-8" \/>/i,
        (m) => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      );
    },
  };
}

// Nhận cả tên không tiền tố (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) vì Vercel không cho
// đặt biến VITE_* ở loại bí mật. Chỉ đúng 2 giá trị công khai này được đưa vào frontend.
function pick(env: Record<string, string>, names: string[]): string {
  for (const n of names) if (env[n]?.trim()) return env[n].trim();
  return "";
}

function assertPublicKey(key: string) {
  let role = "";
  try {
    role = JSON.parse(atob((key.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/"))).role ?? "";
  } catch { /* không phải JWT */ }
  if (key.startsWith("sb_secret_") || role === "service_role") {
    throw new Error("Khoá Supabase cho frontend là khoá BÍ MẬT. Dùng publishable/anon key, và tạo lại khoá bí mật vừa lộ.");
  }
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, ".", "");
  // Chỉ lấy origin: người dùng hay dán nhầm "…supabase.co/rest/v1/" (gây lỗi "Invalid path specified in request URL").
  const rawUrl = pick(env, ["VITE_SUPABASE_URL", "SUPABASE_URL"]);
  const url = rawUrl ? new URL(rawUrl).origin : "";
  if (rawUrl && url !== rawUrl.replace(/\/+$/, "")) console.warn(`[slf] Đã bỏ phần đường dẫn thừa trong SUPABASE_URL, dùng ${url}`);
  const key = pick(env, ["VITE_SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"]);
  assertPublicKey(key);
  if (command === "build") {
    // Chỉ in tên biến tìm thấy, không in giá trị.
    console.log(`[slf] Supabase URL: ${url ? "có" : "THIẾU"}, publishable key: ${key ? "có" : "THIẾU"}`);
    if (env.VERCEL && (!url || !key)) {
      throw new Error(
        "Thiếu SUPABASE_URL hoặc SUPABASE_PUBLISHABLE_KEY lúc build trên Vercel. " +
          "Kiểm tra Settings → Environment Variables (môi trường Production, loại Config) rồi Redeploy.",
      );
    }
  }
  return {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(url),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(key),
    },
    plugins: [react(), cspPlugin(url)],
    build: {
      // Không nhúng asset nhỏ dưới dạng data: cho JS/CSS; giữ mọi thứ là file riêng.
      assetsInlineLimit: 0,
      sourcemap: false,
      // Tách thư viện ra chunk riêng: đổi code app không làm trình duyệt tải lại React/Supabase.
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("@supabase")) return "supabase";
            if (/[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) return "react";
            if (id.includes("lucide-react")) return "icons";
            return undefined;
          },
        },
      },
    },
    server: { port: 5173 },
  };
});
