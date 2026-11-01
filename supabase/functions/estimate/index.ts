// estimate — ước tính số lượt API trước khi chạy discover (mục 4.1 bước 1, mục 10.4).
import { badRequest, intIn, json, oneOf, serve } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { loadSettings } from "../_shared/settings.ts";
import { usageToday } from "../_shared/quota.ts";
import type { DiscoverMode, EstimateResponse } from "../_shared/types.ts";

serve(async (req, body) => {
  const ctx = await requireUser(req);
  const settings = await loadSettings(ctx.db);

  const keywords = body.keywords ?? [];
  if (!Array.isArray(keywords) || keywords.length > 20) throw badRequest("keywords phải là mảng tối đa 20 phần tử");
  const kwCount = keywords.filter((k) => typeof k === "string" && k.trim()).length;
  const pages = intIn(body.pages, 1, 3, 1, "pages");
  const mode = oneOf<DiscoverMode>(body.mode, ["search", "maps", "both"], "search", "mode");

  const serperUnits = kwCount * pages * (mode === "both" ? 2 : 1);
  const [serper, youtube] = await Promise.all([
    usageToday(ctx.db, "serper", ctx.userId),
    usageToday(ctx.db, "youtube", ctx.userId),
  ]);

  const warnings: string[] = [];
  for (const q of [serper, youtube]) {
    const name = q.provider === "serper" ? "Serper" : "YouTube";
    if (q.limit_global > 0 && q.used_global >= q.limit_global * q.warn_ratio) {
      warnings.push(`${name}: đã dùng ${q.used_global}/${q.limit_global} lượt hôm nay (toàn hệ thống).`);
    }
    if (q.limit_user > 0 && q.used_user >= q.limit_user * q.warn_ratio) {
      warnings.push(`${name}: bạn đã dùng ${q.used_user}/${q.limit_user} lượt hôm nay.`);
    }
  }
  if (serperUnits > serper.remaining) {
    warnings.push(`Yêu cầu cần ${serperUnits} lượt nhưng chỉ còn ${serper.remaining} lượt Serper hôm nay.`);
  }

  const res: EstimateResponse = {
    serper_units: serperUnits,
    remaining_today: serper.remaining,
    confirm_above_units: settings.limits.confirm_above_units,
    needs_confirmation: serperUnits > settings.limits.confirm_above_units,
    serper,
    youtube,
    warnings,
  };
  return json(res);
});
