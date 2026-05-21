type TClassValue = string | number | boolean | null | undefined | TClassValue[];

export function cn(...values: TClassValue[]): string {
  const parts: string[] = [];
  const stack: TClassValue[] = [...values];

  while (stack.length > 0) {
    const value = stack.shift();
    if (!value) continue;
    if (Array.isArray(value)) {
      stack.unshift(...value);
      continue;
    }
    parts.push(String(value));
  }

  return parts.join(" ");
}
