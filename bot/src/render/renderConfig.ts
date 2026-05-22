export const renderConfig = {
  dates: {
    lookaheadDays: 7,
    pageSize: 7,
    columns: 3,
  },
  times: {
    pageSize: 12,
    columns: 3,
  },
};

export function chunkRows<T>(items: T[], columns: number): T[][] {
  const safeColumns = Math.max(1, columns);
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += safeColumns) {
    rows.push(items.slice(index, index + safeColumns));
  }

  return rows;
}

export type PageState = {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export type PageNavigationLabels = {
  prev: string;
  next: string;
};

export function buildPageNavigationRow(
  page: PageState,
  prevAction: string,
  nextAction: string,
  infoAction: string,
  labels: PageNavigationLabels,
) {
  if (page.totalPages <= 1) {
    return null;
  }

  return [
    {
      text: page.hasPrev ? labels.prev : " ",
      action: page.hasPrev ? prevAction : infoAction,
    },
    {
      text: `${page.page + 1}/${page.totalPages}`,
      action: infoAction,
    },
    {
      text: page.hasNext ? labels.next : " ",
      action: page.hasNext ? nextAction : infoAction,
    },
  ];
}
