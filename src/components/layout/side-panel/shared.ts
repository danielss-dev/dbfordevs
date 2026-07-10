// Selector for active tab - defined outside component to be stable
export const selectActiveTab = (state: { tabs: { id: string; connectionId: string; tableName?: string; title: string }[]; activeTabId: string | null }) => {
  return state.tabs.find(t => t.id === state.activeTabId);
};
