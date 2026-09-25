import type { JSX } from "preact";

export interface CheckboxProps extends JSX.HTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  disabled?: boolean;
  class?: string;
  className?: string;
}

export function Checkbox({
  checked = false,
  disabled = false,
  class: classNameProp,
  className,
  ...rest
}: CheckboxProps) {
  const extraClass = classNameProp || className || "";

  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      class={`tickbox-input w-7 h-7 border-2 border-ink-primary bg-surface cursor-pointer relative shrink-0 ${extraClass}`}
      {...rest}
    />
  );
}
