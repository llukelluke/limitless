package com.example.limitless.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class StatementRatioTest {

    private static String status(String v, boolean higherIsBetter, double good, double warn) {
        return StatementService.ratio("k", "c", "n", "f", v == null ? null : new BigDecimal(v), "ratio",
                higherIsBetter, good, warn, "").status();
    }

    @Test
    void higherIsBetter() {
        assertEquals("GOOD", status("1.5", true, 1.5, 1.0));
        assertEquals("WARNING", status("1.2", true, 1.5, 1.0));
        assertEquals("BAD", status("0.9", true, 1.5, 1.0));
    }

    @Test
    void lowerIsBetter() {
        assertEquals("GOOD", status("0.4", false, 0.4, 0.6));
        assertEquals("WARNING", status("0.5", false, 0.4, 0.6));
        assertEquals("BAD", status("0.7", false, 0.4, 0.6));
        assertEquals("BAD", status("-0.5", false, 0.4, 0.6)); // negative equity or working capital
    }

    @Test
    void noDataWhenDenominatorIsZero() {
        assertEquals("NONE", status(null, true, 1.5, 1.0));
    }
}
