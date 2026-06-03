export const POWERBI_MCP_READ_TOOLS = [
  "list_datasets",
  "get_dataset_schema",
  "execute_dax_query",
  "list_reports",
  "search_catalog",
] as const;

export const POWERBI_MCP_WRITE_TOOLS = [
  "create_measure",
  "update_measure",
  "create_calculated_column",
  "deploy_semantic_model_changes",
] as const;

export type PowerBiReadTool = (typeof POWERBI_MCP_READ_TOOLS)[number];
export type PowerBiWriteTool = (typeof POWERBI_MCP_WRITE_TOOLS)[number];
export type PowerBiTool = PowerBiReadTool | PowerBiWriteTool;

const readSet = new Set<string>(POWERBI_MCP_READ_TOOLS);
const writeSet = new Set<string>(POWERBI_MCP_WRITE_TOOLS);

export function isPowerBiReadTool(name: string): name is PowerBiReadTool {
  return readSet.has(name);
}

export function isPowerBiWriteTool(name: string): name is PowerBiWriteTool {
  return writeSet.has(name);
}
