// Client-facing phone display mirrors the backend E.164 policy for common inputs.
export function formatPhoneForDisplay(phone?: string) {
  if (!phone) {
    return "-";
  }

  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) {
    return `+${digitsOnly(trimmed)}`;
  }

  if (trimmed.startsWith("00")) {
    return `+${digitsOnly(trimmed.slice(2))}`;
  }

  const digits = digitsOnly(trimmed);
  if (digits.startsWith("0") && digits.length === 10) {
    return `+38${digits}`;
  }

  if (digits.startsWith("380") && digits.length === 12) {
    return `+${digits}`;
  }

  return digits.length > 0 ? `+${digits}` : trimmed;
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}
