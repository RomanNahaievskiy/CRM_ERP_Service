import { Grid } from "antd";

const TABLE_ROW_HEIGHT = 60;
const LAPTOP_VISIBLE_ROWS = 7;
const LARGE_SCREEN_VISIBLE_ROWS = 9;

function useTableRowsByViewport() {
  const screens = Grid.useBreakpoint();
  const visibleRows = screens.xxl ? LARGE_SCREEN_VISIBLE_ROWS : LAPTOP_VISIBLE_ROWS;

  return {
    pageSize: visibleRows,
    scrollY: TABLE_ROW_HEIGHT * visibleRows,
  };
}

export default useTableRowsByViewport;
