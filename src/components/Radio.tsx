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
      class={`appearance-none [border-radius:50%_45%_55%_50%_/_45%_55%_45%_50%] checked:after:content-['●'] checked:after:absolute checked:after:top-[45%] checked:after:left-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 checked:after:text-[1rem] checked:after:text-[#181716] checked:after:font-sans w-7 h-7 border-2 border-ink-primary bg-surface cursor-pointer relative shrink-0 disabled:cursor-not-allowed disabled:opacity-50 ${extraClass}`}
      {...rest}
    />
  );
}
