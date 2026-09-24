/**
 * Slug helper functions for Augury groups.
 */

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function composeSlug(name: string, slugId: string): string {
  const slugified = slugifyName(name);
  if (!slugified) {
    return slugId;
  }
  return `${slugified}-${slugId}`;
}

export function parseSlugId(param: string | undefined | null): string | null {
  if (!param) return null;
  const match = param.match(/(?:^|-)([a-z0-9]{6})$/);
  if (match) {
    return match[1];
  }
  return null;
}
