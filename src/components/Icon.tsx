import type { JSX } from "preact";

export interface IconProps extends JSX.HTMLAttributes<SVGSVGElement> {
  name: "dice" | "chair" | "spikes" | "scroll" | "swords" | "info" | "chest" | "cave" | "castle" | string;
  class?: string;
  className?: string;
}

export function Icon({ name, class: classNameProp, className, ...rest }: IconProps) {
  const finalClass = classNameProp || className || "size-5 inline-block";
  return (
    <svg class={finalClass} aria-hidden="true" {...rest}>
      <use href={`/icons/spritesheet.svg#icon-${name}`} />
    </svg>
  );
}
