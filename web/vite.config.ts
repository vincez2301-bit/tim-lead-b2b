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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  return {
    plugins: [react(), cspPlugin(env.VITE_SUPABASE_URL ?? "")],
    build: {
      // Không nhúng asset nhỏ dưới dạng data: cho JS/CSS; giữ mọi thứ là file riêng.
      assetsInlineLimit: 0,
      sourcemap: false,
    },
    server: { port: 5173 },
  };
});
