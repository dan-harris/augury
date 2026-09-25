import type { ComponentChildren, JSX } from "preact";

export interface RadioProps extends JSX.HTMLAttributes<HTMLInputElement> {
  name?: string;
  value?: string | number;
  checked?: boolean;
  disabled?: boolean;
  class?: string;
  className?: string;
}

export function Radio({
  name,
  value,
  checked = false,
  disabled = false,
  class: classNameProp,
  className,
  ...rest
}: RadioProps) {
  const extraClass = classNameProp || className || "";

  return (
    <input
      type="radio"
      name={name}
      value={value}
      checked={checked}
      disabled={disabled}
      class={`tickbox-input w-7 h-7 border-2 border-ink-primary bg-surface cursor-pointer relative shrink-0 disabled:cursor-not-allowed disabled:opacity-50 ${extraClass}`}
      {...rest}
    />
  );
}
