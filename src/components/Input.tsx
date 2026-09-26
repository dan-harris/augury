import type { JSX } from "preact";

export interface InputProps extends JSX.HTMLAttributes<HTMLInputElement> {
  class?: string;
  className?: string;
}

export function Input({
  class: classNameProp,
  className,
  ...rest
}: InputProps) {
  const extraClass = classNameProp || className || "";

  return (
    <input
      class={`border-b-2 border-ink-primary bg-transparent text-ink-primary focus:outline-none focus:bg-ink-primary/[0.03] ${extraClass}`}
      {...rest}
    />
  );
}
