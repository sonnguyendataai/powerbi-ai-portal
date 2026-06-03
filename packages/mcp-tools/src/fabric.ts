export const FABRIC_CORE_TOOLS = [
  "search",
  "list_workspaces",
  "list_items",
  "get_item",
  "get_item_definition",
  "list_capacities",
] as const;

export type FabricCoreTool = (typeof FABRIC_CORE_TOOLS)[number];

const fabricSet = new Set<string>(FABRIC_CORE_TOOLS);

export function isFabricCoreTool(name: string): name is FabricCoreTool {
  return fabricSet.has(name);
}
