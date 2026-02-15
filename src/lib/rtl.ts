/**
 * Detect if text contains RTL characters (Hebrew, Arabic, etc.)
 * and return the appropriate direction.
 */
export function getTextDirection(text: string): "rtl" | "ltr" {
  // Hebrew: \u0590-\u05FF, Arabic: \u0600-\u06FF
  const rtlPattern = /[\u0590-\u05FF\u0600-\u06FF]/;
  // Count RTL vs LTR characters to determine dominant direction
  const rtlChars = (text.match(/[\u0590-\u05FF\u0600-\u06FF]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;

  if (rtlChars === 0) return "ltr";
  if (latinChars === 0) return "rtl";
  return rtlChars > latinChars ? "rtl" : "ltr";
}

/**
 * Returns className and dir props for text containers
 */
export function rtlProps(text: string): { dir: "rtl" | "ltr"; className: string } {
  const dir = getTextDirection(text);
  return {
    dir,
    className: dir === "rtl" ? "text-right" : "text-left",
  };
}
