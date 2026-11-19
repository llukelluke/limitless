package com.example.limitless.dto;

import java.math.BigDecimal;
import java.util.Map;

/**
 * One financial ratio for the landing page dashboard.
 * category: Profitability | Liquidity | Leverage | Activity | Other.
 * value is null when it can't be worked out; note says why. unit: ratio | percent | times | days | dollars.
 * status: GOOD (green), WARNING (yellow), BAD (red), NONE (no data).
 * higherIsBetter, good and warn are the thresholds behind the status, for drawing the charts.
 * parts: the dollar amounts the ratio is worked out from, in formula order (shown when a chart is clicked).
 */
public record RatioResponse(String key, String category, String name, String formula, BigDecimal value, String unit,
                            String status, boolean higherIsBetter, double good, double warn, String goodRange,
                            String note, Map<String, BigDecimal> parts) {

    public RatioResponse withParts(Map<String, BigDecimal> parts) {
        return new RatioResponse(key, category, name, formula, value, unit, status, higherIsBetter, good, warn, goodRange,
                note, parts);
    }
}
