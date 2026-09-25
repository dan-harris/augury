## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Dependencies

Whenever adding or updating packages, always verify that `package-lock.json` remains in sync by running `npm ci` locally to ensure CI builds will succeed.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## SVG Spritesheet & Icon Workflow

When adding a new SVG icon to the application:

1. **Add Symbol to Spritesheet** (`public/icons/spritesheet.svg`):
   - Wrap icon paths in a `<symbol id="icon-<name>" viewBox="...">`.
   - Strip XML namespaces (`ns0:`), fixed width/height attributes, and any full-canvas background rectangle paths.
   - Convert linework/dark paths to `fill="currentColor"` so icons dynamically inherit surrounding text color. Use `#ffffff` for contrast highlights if needed.

2. **Update Icon Component Props** (`src/components/Icon.astro` & `src/components/Icon.tsx`):
   - Add the new icon name to the `Props` / `IconProps` interface union type (e.g. `name: "dice" | "chair" | "<new_icon>" | string;`).

3. **Update Styleguide Inventory** (`src/pages/styleguide.astro`):
   - Add a preview card to the "Spritesheet Icons" block in `styleguide.astro` for visual verification:
     ```astro
     <div class="border-2 border-ink-primary p-4 flex flex-col items-center justify-center gap-2 bg-parchment-secondary/30 rounded-sm text-center">
       <Icon name="<name>" class="size-10 text-ink-primary" />
       <span class="font-label text-xs uppercase tracking-widest font-bold"><name></span>
       <code class="text-[10px] opacity-70">&lt;Icon name="<name>" /&gt;</code>
     </div>
     ```

4. **Component Usage**:
   - **Astro Components**: `import Icon from "src/components/Icon.astro";` -> `<Icon name="<name>" class="..." />`.
   - **Preact / TSX Islands**: `import { Icon } from "src/components/Icon";` -> `<Icon name="<name>" class="..." />`.

