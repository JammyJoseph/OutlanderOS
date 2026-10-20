// Shared style constants — the redesign's form field.
//
// Standard text input used across the personal (me) forms — profile, settings,
// holiday and the Google account section — so they match the Foundations
// board: 52px tall, 12px radius, field-grey border, ink border and a light
// blue halo on focus.
export const INPUT_CLS =
  'block h-[52px] w-full rounded-lg border border-field bg-card px-4 text-base text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-foreground focus:shadow-[0_0_0_3px_var(--focus)] [&:is(textarea)]:h-auto [&:is(textarea)]:py-3'
