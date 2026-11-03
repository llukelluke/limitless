package com.example.limitless.service;

final class JsonUtil {
    private JsonUtil() {}

    static String q(String s) {
        if (s == null){
            return "null";
        }
        StringBuilder sb = new StringBuilder("\"");
        for (char c : s.toCharArray()){
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> sb.append(c < 0x20 ? String.format("\\u%04x", (int) c): String.valueOf(c));
            }
        }
        return sb.append('"').toString();
    }
}
