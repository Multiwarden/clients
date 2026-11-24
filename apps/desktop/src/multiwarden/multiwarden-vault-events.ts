/**
 * Multiwarden: the id of the item a vault list event acts on (its first item for bulk events),
 * so combined mode can make that item's account active first.
 */
export function multiwardenEventItemId(event: object): string | undefined {
  const { item, items } = event as {
    item?: { id?: unknown };
    items?: Array<{ id?: unknown; cipher?: { id?: unknown } }>;
  };
  const target = item ?? items?.[0]?.cipher ?? items?.[0];
  return target?.id == null ? undefined : String(target.id);
}
