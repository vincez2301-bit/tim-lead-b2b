// Phân loại địa chỉ IP để chống SSRF (mục 8.3, 10.3).
// Mở rộng danh sách trong tài liệu: thêm CGNAT, multicast, dải dành riêng, NAT64, 6to4,
// Teredo, site-local... và phân tích IPv6 đầy đủ thay vì so khớp tiền tố chuỗi.

const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (gồm 169.254.169.254 metadata)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

/** Phân tích IPv4 dạng chấm thập phân chuẩn; trả về số nguyên không dấu hoặc null. */
export function parseIPv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function inCidr4(ip: number, base: string, bits: number): boolean {
  const b = parseIPv4(base)!;
  if (bits === 0) return true;
  const size = 2 ** (32 - bits);
  return Math.floor(ip / size) === Math.floor(b / size);
}

/** Phân tích IPv6 thành 8 nhóm 16-bit; hỗ trợ "::" và đuôi IPv4. Trả về null nếu sai. */
export function parseIPv6(input: string): number[] | null {
  let ip = input.toLowerCase();
  if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);
  const zone = ip.indexOf("%");
  if (zone >= 0) ip = ip.slice(0, zone);
  if (!ip.includes(":")) return null;

  // Đuôi IPv4 (ví dụ ::ffff:127.0.0.1)
  let tail: number[] = [];
  const lastColon = ip.lastIndexOf(":");
  const last = ip.slice(lastColon + 1);
  if (last.includes(".")) {
    const v4 = parseIPv4(last);
    if (v4 === null) return null;
    tail = [Math.floor(v4 / 65536), v4 % 65536];
    ip = ip.slice(0, lastColon + 1) + "0"; // giữ chỗ, thay sau
  }

  const dbl = ip.split("::");
  if (dbl.length > 2) return null;
  const parseGroups = (s: string): number[] | null => {
    if (s === "") return [];
    const out: number[] = [];
    for (const g of s.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };
  const head = parseGroups(dbl[0]);
  const rest = dbl.length === 2 ? parseGroups(dbl[1]) : [];
  if (head === null || rest === null) return null;

  let groups: number[];
  if (dbl.length === 2) {
    const fill = 8 - head.length - rest.length - (tail.length ? 1 : 0);
    if (fill < 0) return null;
    groups = [...head, ...new Array(fill).fill(0), ...rest];
  } else {
    groups = head;
  }
  if (tail.length) {
    // nhóm cuối hiện là "0" giữ chỗ → thay bằng 2 nhóm IPv4
    groups = [...groups.slice(0, groups.length - 1), ...tail];
  }
  if (groups.length !== 8) return null;
  return groups;
}

function v4FromGroups(hi: number, lo: number): number {
  return hi * 65536 + lo;
}

export function isBlockedIPv4(n: number): boolean {
  return BLOCKED_V4.some(([b, bits]) => inCidr4(n, b, bits));
}

export function isBlockedIPv6(g: number[]): boolean {
  const allZeroUpTo = (k: number) => g.slice(0, k).every((x) => x === 0);
  if (g.every((x) => x === 0)) return true; // ::
  if (allZeroUpTo(7) && g[7] === 1) return true; // ::1
  if (allZeroUpTo(5) && g[5] === 0xffff) return isBlockedIPv4(v4FromGroups(g[6], g[7])); // ::ffff:a.b.c.d
  if (allZeroUpTo(6)) return true; // ::a.b.c.d (IPv4-compatible, đã lỗi thời)
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isBlockedIPv4(v4FromGroups(g[6], g[7])); // NAT64 64:ff9b::/96
  }
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 1) return true; // 64:ff9b:1::/48 local NAT64
  if (g[0] === 0x2002) return isBlockedIPv4(v4FromGroups(g[1], g[2])); // 6to4
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo
  if (g[0] === 0x2001 && g[1] === 0xdb8) return true; // documentation
  if (g[0] === 0x100 && g.slice(1, 4).every((x) => x === 0)) return true; // discard 100::/64
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

/** true nếu IP thuộc dải nội bộ / đặc biệt, hoặc không phân tích được (fail closed). */
export function isBlockedIp(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4 !== null) return isBlockedIPv4(v4);
  const v6 = parseIPv6(ip);
  if (v6 !== null) return isBlockedIPv6(v6);
  return true;
}

export function isIpLiteral(host: string): boolean {
  return parseIPv4(host) !== null || parseIPv6(host) !== null;
}
