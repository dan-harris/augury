import type { ComponentChildren, JSX } from "preact";

export interface RadioGroupProps extends JSX.HTMLAttributes<HTMLDivElement> {
  name?: string;
  label?: ComponentChildren;
  class?: string;
  className?: string;
  children?: ComponentChildren;
}

export function RadioGroup({
  name,
  label,
  class: classNameProp,
  className,
  children,
  ...rest
}: RadioGroupProps) {
  const extraClass = classNameProp || className || "";

  return (
    <div role="radiogroup" aria-label={typeof label === "string" ? label : undefined} class={`space-y-3 ${extraClass}`} {...rest}>
      {label && (
        <label class="block font-label text-sm uppercase tracking-wider text-ink-primary font-bold">
          {label}
        </label>
      )}
      {children}
    </div>
  );
}
