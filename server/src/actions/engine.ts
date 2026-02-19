import type { Action, ActionResult, ActionType } from "shared";
import { createRegistry, type RegistryOptions } from "./registry";

export class ActionEngine {
  private registry: Map<ActionType, (params: Record<string, unknown>) => Promise<void>>;

  constructor(opts: RegistryOptions) {
    this.registry = createRegistry(opts);
  }

  async execute(action: Action): Promise<ActionResult> {
    const handler = this.registry.get(action.type);
    if (!handler) {
      return {
        success: false,
        actionType: action.type,
        error: `Unknown action type: ${action.type}`,
      };
    }

    try {
      await handler(action.params as Record<string, unknown>);
      return { success: true, actionType: action.type };
    } catch (err) {
      return {
        success: false,
        actionType: action.type,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
