import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/**
 * Transient (unpersisted) view state shared between the table and the header: whether the
 * table has finished revealing the dealer's hand. Until it has, the header holds back the
 * payout so the bankroll doesn't spoil the result.
 */
export interface TableViewState {
  readonly revealing: boolean;
  readonly setRevealing: (revealing: boolean) => void;
}

export const tableViewStore = createStore<TableViewState>()((set) => ({
  revealing: false,
  setRevealing: (revealing) => {
    set({ revealing });
  },
}));

export function useTableView<T>(selector: (s: TableViewState) => T): T {
  return useStore(tableViewStore, selector);
}
