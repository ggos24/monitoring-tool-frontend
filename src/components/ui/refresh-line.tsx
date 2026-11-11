/**
 * Thin running line at the top of a block that is refreshing. Put it first
 * inside a `relative` container that also carries
 * `data-refreshing={refreshing || undefined}` — the old content then stays
 * visible, dimmed, instead of collapsing to a skeleton (globals.css, Motion).
 */
export function RefreshLine({ active }: { active: boolean }) {
  return active ? <div className="refresh-line" aria-hidden /> : null;
}
