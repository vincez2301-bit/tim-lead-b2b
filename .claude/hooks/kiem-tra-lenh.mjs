#!/usr/bin/env node
// Hook PreToolUse (Bash): biến các quy tắc trong CLAUDE.md thành cổng kiểm tra chạy mọi lần.
// Không chặn hẳn: khi nghi ngờ thì trả "ask" để người dùng tự quyết.
//   - push lên main (= deploy production thật), --all/--mirror, hoặc push khi đang đứng ở main
//   - git commit/push kèm --no-verify
//   - commit file dữ liệu (.xlsx/.xls/.csv/.vcf) hoặc dòng thêm mới có số điện thoại VN (repo công khai)
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let raw = "";
for await (const c of process.stdin) raw += c;
let input = {};
try { input = JSON.parse(raw); } catch { process.exit(0); }
const cmd = String(input.tool_input?.command ?? "");
const cwd = input.cwd || process.cwd();
if (!/\bgit\b/.test(cmd)) process.exit(0);

const git = (...args) => {
  try { return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 32 << 20, stdio: ["ignore", "pipe", "ignore"] }); }
  catch { return ""; }
};
const segments = cmd.split(/&&|\|\||;|\n|\|/);
const sub = (name) => new RegExp(String.raw`\bgit\b(?:\s+-[Cc]\s+\S+)*\s+${name}\b(.*)`);
const tokens = (s) => s.trim().split(/\s+/).filter(Boolean).map((t) => t.replace(/^["']|["']$/g, ""));
const reasons = [];

// 1) push
for (const seg of segments) {
  const m = seg.match(sub("push"));
  if (!m) continue;
  const toks = tokens(m[1]);
  if (toks.includes("--no-verify")) reasons.push("git push --no-verify bỏ qua kiểm tra.");
  if (toks.some((t) => t === "--all" || t === "--mirror")) reasons.push("push --all/--mirror sẽ đẩy cả nhánh main.");
  const args = toks.filter((t) => !t.startsWith("-"));
  const refspecs = args.slice(1);
  if (refspecs.some((r) => /^\+?([^:]*:)?(refs\/heads\/)?main$/.test(r))) {
    reasons.push("Push lên main = deploy production thật (Vercel + Supabase).");
  } else if (refspecs.length === 0 && git("rev-parse", "--abbrev-ref", "HEAD").trim() === "main") {
    reasons.push("Đang đứng ở nhánh main: push lúc này = deploy production thật.");
  }
}

// 2) commit
const commitSeg = segments.map((s) => s.match(sub("commit"))).find(Boolean);
if (commitSeg) {
  const ctoks = tokens(commitSeg[1]);
  if (ctoks.includes("--no-verify") || ctoks.includes("-n")) reasons.push("git commit --no-verify bỏ qua kiểm tra.");

  // Ước lượng những gì sẽ được commit: đã stage + (nếu lệnh có git add / commit -a) thay đổi chưa stage và tệp mới.
  const addSeg = segments.map((s) => s.match(sub("add"))).find(Boolean);
  const commitAll = ctoks.some((t) => t === "--all" || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(t));
  const addArgs = addSeg ? tokens(addSeg[1]).filter((t) => !t.startsWith("-")) : [];
  const addBroad = addSeg && (addArgs.length === 0 || addArgs.some((a) => a === "." || a === ":/" || a.includes("*")) ||
    tokens(addSeg[1]).some((t) => t === "-A" || t === "--all"));
  const inAdd = (f) => addBroad || addArgs.some((a) => f === a || f.startsWith(a.replace(/\/?$/, "/")));

  const added = []; // [tệp, dòng]
  const files = new Set();
  const parseDiff = (diff, keep) => {
    let file = "";
    for (const line of diff.split("\n")) {
      if (line.startsWith("+++ ")) { file = line.replace(/^\+\+\+ (b\/)?/, ""); if (keep(file)) files.add(file); continue; }
      if (line.startsWith("+") && file && keep(file)) added.push([file, line.slice(1)]);
    }
  };
  parseDiff(git("diff", "--cached", "-U0", "--no-color"), () => true);
  if (commitAll || addSeg) parseDiff(git("diff", "-U0", "--no-color"), (f) => commitAll || inAdd(f));
  if (addSeg) {
    for (const f of git("ls-files", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean)) {
      if (!inAdd(f)) continue;
      files.add(f);
      try {
        const p = join(cwd, f);
        if (statSync(p).size > 512 * 1024) continue;
        const text = readFileSync(p, "utf8");
        if (!text.includes("\0")) for (const line of text.split("\n")) added.push([f, line]);
      } catch { /* bỏ qua */ }
    }
  }

  const dataFiles = [...files].filter((f) => /\.(xlsx|xls|csv|vcf)$/i.test(f));
  if (dataFiles.length) reasons.push(`Sắp commit file dữ liệu (repo công khai): ${dataFiles.slice(0, 5).join(", ")}.`);

  // SĐT di động (03/05/07/08/09) và cố định (02x); bỏ qua số mẫu kiểu 0901 234 567, 028 3838 3838, 0000000… và đoạn trong UUID
  const phoneRe = /(?<![0-9A-Za-z])(?:\+?84|0)[\s.-]?(?:[35789]|2\d)(?:[\s.-]?\d){7,8}(?![0-9A-Za-z])/g;
  const hits = [];
  for (const [f, line] of added) {
    for (const m of line.matchAll(phoneRe)) {
      const d = m[0].replace(/\D/g, "").replace(/^84/, "0");
      const ok = d[1] === "2" ? d.length === 11 : d.length === 10;
      if (!ok || /1234|(\d)\1{5}|(\d\d)\2{3}/.test(d)) continue;
      hits.push(`${f}: ${m[0].trim()}`);
    }
  }
  if (hits.length) reasons.push(`Có số điện thoại trong nội dung sắp commit (repo công khai): ${hits.slice(0, 3).join("; ")}${hits.length > 3 ? "…" : ""}`);
}

if (reasons.length) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: `Cần xác nhận: ${reasons.join(" ")}`,
    },
  }));
}
process.exit(0);
