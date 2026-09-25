import type { MissionFamily } from "$lib/domain/mission";

/** Group only this bounded page, preserving source family and member order. */
export function groupMissionsByFamily<T extends { family: MissionFamily }>(
  items: readonly T[]
): { family: MissionFamily; items: T[] }[] {
  const groups = new Map<MissionFamily, { family: MissionFamily; items: T[] }>();

  for (const item of items) {
    const group = groups.get(item.family);
    if (group) {
      group.items.push(item);
    } else {
      groups.set(item.family, { family: item.family, items: [item] });
    }
  }

  return [...groups.values()];
}
