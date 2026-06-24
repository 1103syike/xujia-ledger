import { formatLocalDate, todayLocalDate } from '../transactions/transaction-date';

export interface CalendarDayCell {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

export function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/** 月曆格（週日為一週起點，6 列 × 7 欄） */
export function buildMonthGrid(
  viewYear: number,
  viewMonth: number,
  selectedIso: string,
  todayIso = todayLocalDate()
): CalendarDayCell[] {
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(viewYear, viewMonth, 1 - startOffset);
  const cells: CalendarDayCell[] = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    );
    const iso = formatLocalDate(date);
    cells.push({
      iso,
      day: date.getDate(),
      inMonth: date.getMonth() === viewMonth,
      isToday: iso === todayIso,
      isSelected: iso === selectedIso,
    });
  }

  return cells;
}
