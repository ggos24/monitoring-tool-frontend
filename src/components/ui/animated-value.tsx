"use client";

import { useAnimatedNumber } from "@/lib/motion";

// prefix · number (with thousands separators / decimals) · suffix
const NUMBER = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/;

/**
 * A formatted figure ("1,234", "4.7%") that counts to its new value when it
 * changes. Text without a number ("—") is shown as is.
 */
export function AnimatedValue({ value }: { value: string | number }) {
  const text = String(value);
  const match = text.match(NUMBER);
  const target = match ? Number(match[2].replace(/,/g, "")) : null;
  const shown = useAnimatedNumber(target);
  if (!match || shown === null) return <>{text}</>;
  const decimals = match[2].split(".")[1]?.length ?? 0;
  return (
    <>
      {match[1]}
      {shown.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {match[3]}
    </>
  );
}
