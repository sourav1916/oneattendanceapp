export const YEAR_ITEM_HEIGHT = 48;
export const YEAR_ITEM_GAP = 4;
export const YEAR_ROW_HEIGHT = YEAR_ITEM_HEIGHT + YEAR_ITEM_GAP;
export const YEAR_LIST_VIEW_HEIGHT = 252;
export const YEAR_LIST_PAD = (YEAR_LIST_VIEW_HEIGHT - YEAR_ITEM_HEIGHT) / 2;

export function indexFromScrollOffset(offsetY: number, maxIndex: number): number {
  const index = Math.round(offsetY / YEAR_ROW_HEIGHT);
  return Math.max(0, Math.min(maxIndex, index));
}
