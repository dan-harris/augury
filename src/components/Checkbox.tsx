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
      class={`appearance-none [border-radius:3px_255px_5px_25px_/_255px_5px_225px_3px] checked:after:content-['✘'] checked:after:absolute checked:after:top-[45%] checked:after:left-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 checked:after:text-[1.4rem] checked:after:text-[#181716] checked:after:font-sans w-7 h-7 border-2 border-ink-primary bg-surface cursor-pointer relative shrink-0 ${extraClass}`}
      {...rest}
    />
  );
}
