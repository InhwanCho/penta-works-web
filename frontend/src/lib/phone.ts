export function phoneDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/[^0-9]/g, "").slice(0, 11);
}

export function formatPhone(value: string | null | undefined): string {
  const digits = phoneDigits(value);
  if (digits.length <= 3) return digits;
  const middleLength = digits.startsWith("010") || digits.length === 11 ? 4 : 3;
  const middleEnd = 3 + middleLength;
  if (digits.length <= middleEnd) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, middleEnd)}-${digits.slice(middleEnd)}`;
}
