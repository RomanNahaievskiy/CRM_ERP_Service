import { useEffect, useState, type CSSProperties } from "react";
import {
  // CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  FileProtectOutlined,
  LeftOutlined,
  MoreOutlined,
  PlusOutlined,
  RightOutlined,
  SwapOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Grid,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import type { DatePickerProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { adminRepository } from "../api/adminRepository";
import type {
  BookingListItem,
  BookingListOption,
  BookingListAllocation,
  OperationsSchedule,
  ServicePost,
} from "../api/types";
import AppModal from "../components/AppModal";

const SCHEDULE_DAYS_COUNT = 14;
const DAY_COLUMN_WIDTH = 128;
const POST_COLUMN_WIDTH = 148;
const SLOT_ROW_HEIGHT = 48;
const DEFAULT_WORKDAY_START_MINUTES = 8 * 60;
const DEFAULT_WORKDAY_END_MINUTES = 18 * 60;
const DEFAULT_SLOT_STEP_MINUTES = 15;

type SlotStatus = "working" | "outside_hours";

type BookingStatus = "new" | "confirmed" | "canceled" | "done" | "no_show";

type BookingClientType = "retail" | "contract" | "system";

type ScheduleBooking = BookingListItem & {
  status: BookingStatus;
  clientType: BookingClientType;
  options: BookingListOption[];
  allocations: BookingListAllocation[];
  comment: string;
  admin: string;
};

type ScheduleAllocationSegment = BookingListAllocation & {
  booking: ScheduleBooking;
  allocations: BookingListAllocation[];
};

type ScheduleCell = {
  status: SlotStatus;
  booking?: ScheduleBooking;
  allocation?: ScheduleAllocationSegment;
  coveredByBookingId?: number;
  coveredByAllocationId?: number;
};

type ScheduleRow = {
  key: string;
  time: string;
} & Record<string, ScheduleCell | string>;

type SelectedSlot = {
  day: Dayjs;
  time: string;
};

type ScheduleTableViewProps = {
  columns: ColumnsType<ScheduleRow>;
  isLoading: boolean;
  rowHeight: number;
  rows: ScheduleRow[];
  scrollX: number;
};

type ScheduleMobileDayViewProps = {
  bookings: ScheduleBooking[];
  day: Dayjs;
  isLoading: boolean;
  schedule: OperationsSchedule;
  slotStepMinutes: number;
  slotTimes: string[];
  onCreateBookingDraft: (day: Dayjs, time: string) => void;
  onOpenBookingDetails: (booking: ScheduleBooking) => void;
  onNextDay: () => void;
  onPreviousDay: () => void;
};

const bookingStatusLabels: Record<BookingStatus, string> = {
  new: "Нове",
  confirmed: "Підтверджене",
  canceled: "Скасоване",
  done: "Виконане",
  no_show: "Не з'явився",
};

const bookingClientTypeLabels: Record<BookingClientType, string> = {
  retail: "Рітейл",
  contract: "Контракт",
  system: "Системне",
};

const slotLabels: Record<SlotStatus, string> = {
  working: "",
  outside_hours: "Неробочий час",
};

const slotColors: Record<SlotStatus, string> = {
  working: "default",
  outside_hours: "default",
};

// Перетворює кількість хвилин від початку доби у рядок часу формату HH:mm.
function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// Створює список часових слотів для видимого діапазону часу.
function createSlotTimes(
  startMinutes: number,
  endMinutes: number,
  stepMinutes: number,
) {
  const times: string[] = [];

  for (
    let current = startMinutes;
    current < endMinutes;
    current += stepMinutes
  ) {
    times.push(minutesToTime(current));
  }

  return times;
}

// Формує масив днів, які треба показати у таблиці розкладу, починаючи з вибраної дати.
function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);

  while (b > 0) {
    const next = a % b;
    a = b;
    b = next;
  }

  return a || DEFAULT_SLOT_STEP_MINUTES;
}

function getAllocationAwareSlotStep(
  bookings: ScheduleBooking[],
  fallbackStepMinutes: number,
) {
  const steps = bookings.flatMap((booking) =>
    booking.allocations.flatMap((allocation) => [
      timeToMinutes(getAllocationStartTime(allocation)),
      timeToMinutes(getAllocationEnd(allocation).format("HH:mm")),
      getAllocationDurationMinutes(allocation),
    ]),
  );

  const rawStep = steps.reduce(
    (currentStep, value) => greatestCommonDivisor(currentStep, value),
    fallbackStepMinutes,
  );

  return Math.max(5, rawStep);
}

function getSegmentRowHeight(
  segmentStepMinutes: number,
  displayStepMinutes: number,
) {
  return Math.max(
    16,
    Math.round((segmentStepMinutes / displayStepMinutes) * SLOT_ROW_HEIGHT),
  );
}

function shouldShowTimeLabel(time: string, displayStepMinutes: number) {
  return timeToMinutes(time) % displayStepMinutes === 0;
}

function getTimeCellRowSpan(
  time: string,
  segmentStepMinutes: number,
  displayStepMinutes: number,
) {
  if (!shouldShowTimeLabel(time, displayStepMinutes)) {
    return 0;
  }

  return Math.max(1, Math.round(displayStepMinutes / segmentStepMinutes));
}

function getScheduleDays(startDate: Dayjs) {
  return Array.from({ length: SCHEDULE_DAYS_COUNT }, (_, index) =>
    startDate.add(index, "day"),
  );
}

function getDefaultOperationsSchedule(startDate: Dayjs): OperationsSchedule {
  return {
    slotStepMinutes: DEFAULT_SLOT_STEP_MINUTES,
    days: getScheduleDays(startDate).map((day) => ({
      date: getDayKey(day),
      workingWindows: [
        {
          startMinutes: DEFAULT_WORKDAY_START_MINUTES,
          endMinutes: DEFAULT_WORKDAY_END_MINUTES,
          startsAt: minutesToTime(DEFAULT_WORKDAY_START_MINUTES),
          endsAt: minutesToTime(DEFAULT_WORKDAY_END_MINUTES),
        },
      ],
    })),
  };
}

// Робить стабільний ключ дня для колонок таблиці та пошуку бронювань за датою.
function getDayKey(day: Dayjs) {
  return day.format("YYYY-MM-DD");
}

// Перетворює рядок часу HH:mm у кількість хвилин від початку доби для порівнянь.
function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);

  return hours * 60 + minutes;
}

function getScheduleDay(schedule: OperationsSchedule, day: Dayjs) {
  const dayKey = getDayKey(day);

  return schedule.days.find((item) => item.date === dayKey);
}

function getWorkingWindowsForSlot(
  schedule: OperationsSchedule,
  day: Dayjs,
  postId?: string,
) {
  const scheduleDay = getScheduleDay(schedule, day);

  if (!postId) {
    return scheduleDay?.workingWindows ?? [];
  }

  return (
    scheduleDay?.posts?.find((post) => post.id === postId)?.workingWindows ??
    scheduleDay?.workingWindows ??
    []
  );
}

function getVisibleScheduleRange(schedule: OperationsSchedule) {
  const windows = schedule.days.flatMap((day) => [
    ...day.workingWindows,
    ...(day.posts ?? []).flatMap((post) => post.workingWindows),
  ]);

  if (!windows.length) {
    return {
      startMinutes: DEFAULT_WORKDAY_START_MINUTES,
      endMinutes: DEFAULT_WORKDAY_END_MINUTES,
    };
  }

  return {
    startMinutes: Math.min(...windows.map((window) => window.startMinutes)),
    endMinutes: Math.max(...windows.map((window) => window.endMinutes)),
  };
}

function isTimeInsideWorkingWindows(
  schedule: OperationsSchedule,
  day: Dayjs,
  time: string,
  postId?: string,
) {
  const minutes = timeToMinutes(time);

  return Boolean(
    getWorkingWindowsForSlot(schedule, day, postId).some(
      (window) => window.startMinutes <= minutes && minutes < window.endMinutes,
    ),
  );
}

// Дістає дату початку з мок-бронювання у форматі Dayjs для подальших обчислень.
function getBookingStart(booking: ScheduleBooking) {
  return dayjs(booking.startsAt);
}

// Дістає дату завершення з мок-бронювання у форматі Dayjs для розрахунку тривалості.
function getBookingEnd(booking: ScheduleBooking) {
  return dayjs(booking.endsAt);
}

// Обчислює ключ дня з реального поля startsAt, як це потім робитимемо з API-даними.
function getBookingDayKey(booking: ScheduleBooking) {
  return getDayKey(getBookingStart(booking));
}

// Обчислює час старту бронювання з startsAt у форматі HH:mm.
function getBookingStartTime(booking: ScheduleBooking) {
  return getBookingStart(booking).format("HH:mm");
}

// Обчислює тривалість бронювання з startsAt і endsAt, як у моделі Booking.
function getBookingDurationMinutes(booking: ScheduleBooking) {
  return getBookingEnd(booking).diff(getBookingStart(booking), "minute");
}

// Нормалізує статус з API до відомих статусів розкладу.
function normalizeBookingStatus(status: string): BookingStatus {
  if (
    status === "new" ||
    status === "confirmed" ||
    status === "canceled" ||
    status === "done" ||
    status === "no_show"
  ) {
    return status;
  }

  return "new";
}

// Перетворює booking з API на форму, з якою працює сторінка розкладу.
function toScheduleBooking(item: BookingListItem): ScheduleBooking {
  const fallbackAllocation: BookingListAllocation = {
    id: item.id,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    sortOrder: 0,
    postId: item.postId,
    postTitle: item.postTitle,
    serviceTitle: item.serviceTitle,
    optionTitle: "",
  };

  return {
    ...item,
    status: normalizeBookingStatus(item.status),
    clientType:
      item.clientType === "contract" || item.clientType === "system"
        ? item.clientType
        : "retail",
    options: item.options ?? [],
    allocations:
      item.allocations && item.allocations.length > 0
        ? item.allocations
        : item.postId
          ? [fallbackAllocation]
          : [],
    comment: item.comment ?? "",
    admin: item.admin ?? "",
  };
}

// Вирішує, чи бронювання має блокувати слот у розкладі.
function blocksScheduleSlot(booking: ScheduleBooking) {
  return booking.status !== "canceled";
}

// Визначає, чи конкретний слот входить у робочі вікна operations schedule.
function getSlotStatus(
  schedule: OperationsSchedule,
  day: Dayjs,
  time: string,
  postId?: string,
): SlotStatus {
  return isTimeInsideWorkingWindows(schedule, day, time, postId)
    ? "working"
    : "outside_hours";
}

// Шукає бронювання, яке займає конкретний день і часовий слот.
function findBookingForSlot(
  bookings: ScheduleBooking[],
  dayKey: string,
  time: string,
) {
  const slotStart = timeToMinutes(time);

  return bookings.find((booking) => {
    if (getBookingDayKey(booking) !== dayKey) {
      return false;
    }

    const bookingStart = timeToMinutes(getBookingStartTime(booking));
    const bookingEnd = bookingStart + getBookingDurationMinutes(booking);

    return slotStart >= bookingStart && slotStart < bookingEnd;
  });
}

function getAllocationStart(allocation: BookingListAllocation) {
  return dayjs(allocation.startsAt);
}

function getAllocationEnd(allocation: BookingListAllocation) {
  return dayjs(allocation.endsAt);
}

function getAllocationDayKey(allocation: BookingListAllocation) {
  return getDayKey(getAllocationStart(allocation));
}

function getAllocationStartTime(allocation: BookingListAllocation) {
  return getAllocationStart(allocation).format("HH:mm");
}

function getAllocationDurationMinutes(allocation: BookingListAllocation) {
  return getAllocationEnd(allocation).diff(
    getAllocationStart(allocation),
    "minute",
  );
}

function mergeAdjacentAllocations(
  booking: ScheduleBooking,
  postId: string,
  dayKey: string,
) {
  const allocations = booking.allocations
    .filter(
      (allocation) =>
        allocation.postId === postId && getAllocationDayKey(allocation) === dayKey,
    )
    .sort((left, right) => {
      const byStart =
        getAllocationStart(left).valueOf() - getAllocationStart(right).valueOf();

      return byStart || left.sortOrder - right.sortOrder;
    });
  const segments: ScheduleAllocationSegment[] = [];

  allocations.forEach((allocation) => {
    const previousSegment = segments.at(-1);

    if (
      previousSegment &&
      previousSegment.booking.id === booking.id &&
      previousSegment.postId === allocation.postId &&
      getAllocationEnd(previousSegment).isSame(getAllocationStart(allocation))
    ) {
      previousSegment.endsAt = allocation.endsAt;
      previousSegment.allocations.push(allocation);
      return;
    }

    segments.push({
      ...allocation,
      booking,
      allocations: [allocation],
    });
  });

  return segments;
}

function getAllocationSegmentTitle(segment: ScheduleAllocationSegment) {
  return segment.allocations
    .map((allocation) => allocation.optionTitle || allocation.serviceTitle)
    .filter(Boolean)
    .join(" + ");
}

function findAllocationSegmentForSlot(
  bookings: ScheduleBooking[],
  dayKey: string,
  postId: string,
  time: string,
): ScheduleAllocationSegment | undefined {
  const slotStart = timeToMinutes(time);

  for (const booking of bookings) {
    for (const segment of mergeAdjacentAllocations(booking, postId, dayKey)) {
      const segmentStart = timeToMinutes(getAllocationStartTime(segment));
      const segmentEnd = segmentStart + getAllocationDurationMinutes(segment);

      if (slotStart >= segmentStart && slotStart < segmentEnd) {
        return segment;
      }
    }
  }

  return undefined;
}

// Перевіряє, чи слот уже в минулому, щоб не дозволяти створювати бронювання заднім числом.
function isSlotInPast(day: Dayjs, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const slotDateTime = day.hour(hours).minute(minutes).second(0).millisecond(0);

  return slotDateTime.isBefore(dayjs());
}

// Вирішує, чи можна почати створення нового бронювання з конкретної клітинки таблиці.
function canCreateBookingInCell(cell: ScheduleCell, day: Dayjs, time: string) {
  // Нове бронювання можна почати тільки з вільного майбутнього слота.
  // Зайняті, закриті, минулі та накриті довгою бронню слоти не запускають створення.
  return (
    cell.status === "working" &&
    !cell.booking &&
    !cell.coveredByBookingId &&
    !isSlotInPast(day, time)
  );
}

// Перетворює список днів і бронювань у рядки для Ant Design Table.
function createScheduleRows(
  days: Dayjs[],
  bookings: ScheduleBooking[],
  schedule: OperationsSchedule,
  slotTimes: string[],
): ScheduleRow[] {
  return slotTimes.map((time) => {
    const row: ScheduleRow = {
      key: time,
      time,
    };

    days.forEach((day) => {
      const dayKey = getDayKey(day);
      const booking = findBookingForSlot(bookings, dayKey, time);
      const isBookingStart = booking
        ? getBookingStartTime(booking) === time
        : false;

      row[dayKey] = {
        status: getSlotStatus(schedule, day, time),
        booking: isBookingStart ? booking : undefined,
        coveredByBookingId: booking && !isBookingStart ? booking.id : undefined,
      };
    });

    return row;
  });
}

function getResourceColumnKey(day: Dayjs, postId: string) {
  return `${getDayKey(day)}__${postId}`;
}

function createResourceScheduleRows(
  days: Dayjs[],
  posts: ServicePost[],
  bookings: ScheduleBooking[],
  schedule: OperationsSchedule,
  slotTimes: string[],
): ScheduleRow[] {
  // TODO: Коли resource-view виросте, замінити табличний рендер на легшу calendar/grid-модель.
  // Ідея: зберегти 5-хв сегментну сітку, але перед рендером будувати Map(day+post+time -> segment),
  // обмежувати видимий діапазон днів/постів і за потреби перейти на віртуалізацію рядків/колонок.
  return slotTimes.map((time) => {
    const row: ScheduleRow = {
      key: time,
      time,
    };

    days.forEach((day) => {
      const dayKey = getDayKey(day);

      posts.forEach((post) => {
        const allocation = findAllocationSegmentForSlot(
          bookings,
          dayKey,
          post.id,
          time,
        );
        const isAllocationStart = allocation
          ? getAllocationStartTime(allocation) === time
          : false;

        row[getResourceColumnKey(day, post.id)] = {
          status: getSlotStatus(schedule, day, time, post.id),
          booking: isAllocationStart ? allocation?.booking : undefined,
          allocation: isAllocationStart ? allocation : undefined,
          coveredByBookingId:
            allocation && !isAllocationStart
              ? allocation.booking.id
              : undefined,
          coveredByAllocationId:
            allocation && !isAllocationStart ? allocation.id : undefined,
        };
      });
    });

    return row;
  });
}

// Малює візуальну картку бронювання всередині першої клітинки зайнятого проміжку.
function renderBookingCard(
  booking: ScheduleBooking,
  slotStepMinutes: number,
  variant: "table" | "mobile" = "table",
  onOpenDetails?: (booking: ScheduleBooking) => void,
  allocation?: ScheduleAllocationSegment,
  rowHeight = SLOT_ROW_HEIGHT,
) {
  const durationMinutes = allocation
    ? getAllocationDurationMinutes(allocation)
    : getBookingDurationMinutes(booking);
  const startsAt = allocation ? allocation.startsAt : booking.startsAt;
  const stageTitle =
    allocation ? getAllocationSegmentTitle(allocation) : booking.serviceTitle;
  const postTitle = allocation?.postTitle || booking.postTitle;
  const height = (durationMinutes / slotStepMinutes) * rowHeight - 8;
  const isContractBooking = booking.clientType === "contract";

  return (
    <Card
      className={[
        "schedule-booking-card",
        variant === "mobile" ? "schedule-booking-card_mobile" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      size="small"
      style={variant === "table" ? { height } : undefined}
      role="button"
      tabIndex={0}
      extra={
        onOpenDetails ? (
          <Button
            aria-label="Дії з бронюванням"
            className="schedule-booking-card__actions"
            icon={<MoreOutlined />}
            size="small"
            type="text"
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetails(booking);
            }}
          />
        ) : undefined
      }
      title={
        <div className="schedule-booking-card__title">
          {isContractBooking && (
            <span className="schedule-booking-card__badge">
              <FileProtectOutlined aria-hidden="true" />
              <span>Контракт</span>
            </span>
          )}
          <span className="schedule-booking-card__title-text">
            {stageTitle} {dayjs(startsAt).format("HH:mm")}
          </span>
        </div>
      }
      onClick={() => onOpenDetails?.(booking)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetails?.(booking);
        }
      }}
    >
      <div>{booking.clientName}</div>
      <div>{booking.clientPhone}</div>
      <div>{booking.vehicleNumber}</div>
      <div>{booking.vehicleTypeTitle}</div>
      {allocation && allocation.allocations.length > 1 && (
        <div className="schedule-booking-card__stages">
          {allocation.allocations.map((item) => (
            <span key={item.id}>{item.optionTitle || item.serviceTitle}</span>
          ))}
        </div>
      )}
      <div className="schedule-booking-card__meta">{postTitle}</div>
    </Card>
  );
}

// Створює колонки таблиці розкладу: одну колонку часу та окрему колонку для кожного дня.
function createScheduleColumns(
  days: Dayjs[],
  slotStepMinutes: number,
  displayStepMinutes: number,
  onCreateBookingDraft: (day: Dayjs, time: string) => void,
  onOpenBookingDetails: (booking: ScheduleBooking) => void,
): ColumnsType<ScheduleRow> {
  return [
    {
      title: "Час",
      dataIndex: "time",
      key: "time",
      fixed: "left",
      width: 92,
      className: "schedule-time-cell",
      onCell: (record: ScheduleRow) => ({
        rowSpan: getTimeCellRowSpan(
          record.time,
          slotStepMinutes,
          displayStepMinutes,
        ),
      }),
      render: (time: string) => time,
    },
    ...days.map((day) => {
      const dayKey = getDayKey(day);

      return {
        title: (
          <Space direction="vertical" size={0}>
            <span>{day.format("dd")}</span>
            <span>{day.format("DD.MM")}</span>
          </Space>
        ),
        dataIndex: dayKey,
        key: dayKey,
        width: DAY_COLUMN_WIDTH,
        onCell: (record: ScheduleRow) => {
          const cell = record[dayKey] as ScheduleCell;
          const isPast = isSlotInPast(day, record.time);
          const canCreate = canCreateBookingInCell(cell, day, record.time);

          return {
            className: [
              "schedule-slot-cell",
              canCreate ? "schedule-slot-cell_create" : "",
              isPast ? "schedule-slot-cell_past" : "",
              cell.status !== "working" || cell.coveredByBookingId
                ? "schedule-slot-cell_disabled"
                : "",
            ]
              .filter(Boolean)
              .join(" "),
            onClick: () => {
              if (canCreate) {
                onCreateBookingDraft(day, record.time);
              }
            },
          };
        },
        render: (value: ScheduleCell) => {
          // Вільні та зайняті "продовженням" броні слоти лишаємо порожніми.
          // Видиму картку малюємо тільки у першій клітинці бронювання.
          if (value.booking) {
            return renderBookingCard(
              value.booking,
              slotStepMinutes,
              "table",
              onOpenBookingDetails,
            );
          }

          if (value.status === "working" || value.coveredByBookingId) {
            return null;
          }

          return (
            <Tag color={slotColors[value.status]}>
              {slotLabels[value.status]}
            </Tag>
          );
        },
      };
    }),
  ];
}

// Desktop-вигляд розкладу: широка таблиця на кілька днів з горизонтальним скролом.
function createResourceScheduleColumns(
  days: Dayjs[],
  posts: ServicePost[],
  slotStepMinutes: number,
  displayStepMinutes: number,
  rowHeight: number,
  onCreateBookingDraft: (day: Dayjs, time: string) => void,
  onOpenBookingDetails: (booking: ScheduleBooking) => void,
): ColumnsType<ScheduleRow> {
  return [
    {
      title: "Час",
      dataIndex: "time",
      key: "time",
      fixed: "left",
      width: 92,
      className: "schedule-time-cell",
      onCell: (record: ScheduleRow) => ({
        rowSpan: getTimeCellRowSpan(
          record.time,
          slotStepMinutes,
          displayStepMinutes,
        ),
      }),
      render: (time: string) => time,
    },
    ...days.map((day) => ({
      title: (
        <Space direction="vertical" size={0}>
          <span>{day.format("dd")}</span>
          <span>{day.format("DD.MM")}</span>
        </Space>
      ),
      key: getDayKey(day),
      children: posts.map((post) => {
        const columnKey = getResourceColumnKey(day, post.id);

        return {
          title: post.title,
          dataIndex: columnKey,
          key: columnKey,
          width: POST_COLUMN_WIDTH,
          onCell: (record: ScheduleRow) => {
            const cell = record[columnKey] as ScheduleCell;
            const isPast = isSlotInPast(day, record.time);
            const canCreate = canCreateBookingInCell(cell, day, record.time);

            return {
              className: [
                "schedule-slot-cell",
                canCreate ? "schedule-slot-cell_create" : "",
                isPast ? "schedule-slot-cell_past" : "",
                cell.status !== "working" || cell.coveredByAllocationId
                  ? "schedule-slot-cell_disabled"
                  : "",
              ]
                .filter(Boolean)
                .join(" "),
              onClick: () => {
                if (canCreate) {
                  onCreateBookingDraft(day, record.time);
                }
              },
            };
          },
          render: (value: ScheduleCell) => {
            if (value.booking) {
              return renderBookingCard(
                value.booking,
                slotStepMinutes,
                "table",
                onOpenBookingDetails,
                value.allocation,
                rowHeight,
              );
            }

            if (value.status === "working" || value.coveredByAllocationId) {
              return null;
            }

            return (
              <Tag color={slotColors[value.status]}>
                {slotLabels[value.status]}
              </Tag>
            );
          },
        };
      }),
    })),
  ];
}

function ScheduleTableView({
  columns,
  isLoading,
  rowHeight,
  rows,
  scrollX,
}: ScheduleTableViewProps) {
  return (
    <Table
      className="schedule-table"
      columns={columns}
      dataSource={rows}
      loading={isLoading}
      pagination={false}
      scroll={{ x: scrollX, y: 55 * 8 }}
      size="small"
      style={{ "--schedule-row-height": `${rowHeight}px` } as CSSProperties}
      bordered
    />
  );
}

// Мобільний вигляд розкладу: один день вертикальним списком слотів і бронювань.
function ScheduleMobileDayView({
  bookings,
  day,
  isLoading,
  schedule,
  slotStepMinutes,
  slotTimes,
  onCreateBookingDraft,
  onOpenBookingDetails,
  onNextDay,
  onPreviousDay,
}: ScheduleMobileDayViewProps) {
  const dayKey = getDayKey(day);

  if (isLoading) {
    return <Card loading />;
  }

  return (
    <div className="schedule-mobile">
      <div className="schedule-mobile__nav">
        <Button
          aria-label="Попередній день"
          icon={<LeftOutlined />}
          onClick={onPreviousDay}
        />
        <div className="schedule-mobile__date">
          <strong>{day.format("DD.MM.YYYY")}</strong>
          <span>{day.format("dddd")}</span>
        </div>
        <Button
          aria-label="Наступний день"
          icon={<RightOutlined />}
          onClick={onNextDay}
        />
      </div>

      <div className="schedule-mobile__timeline">
        {slotTimes.map((time) => {
          const booking = findBookingForSlot(bookings, dayKey, time);
          const isBookingStart = booking
            ? getBookingStartTime(booking) === time
            : false;
          const cell: ScheduleCell = {
            status: getSlotStatus(schedule, day, time),
            booking: isBookingStart ? booking : undefined,
            coveredByBookingId:
              booking && !isBookingStart ? booking.id : undefined,
          };
          const canCreate = canCreateBookingInCell(cell, day, time);

          if (cell.coveredByBookingId) {
            return null;
          }

          return (
            <div className="schedule-mobile__slot" key={time}>
              <div className="schedule-mobile__time">{time}</div>
              <div className="schedule-mobile__content">
                {cell.booking ? (
                  renderBookingCard(
                    cell.booking,
                    slotStepMinutes,
                    "mobile",
                    onOpenBookingDetails,
                  )
                ) : canCreate ? (
                  <Button
                    block
                    className="schedule-mobile__create"
                    icon={<PlusOutlined />}
                    onClick={() => onCreateBookingDraft(day, time)}
                  >
                    Створити бронювання
                  </Button>
                ) : (
                  <Tag color={slotColors[cell.status]}>
                    {slotLabels[cell.status]}
                  </Tag>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Основний компонент сторінки розкладу: тримає стан дат, бронювань і модального вікна.
function SchedulePage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [startDate, setStartDate] = useState(dayjs().startOf("day"));
  const [operationsSchedule, setOperationsSchedule] =
    useState<OperationsSchedule>(() => getDefaultOperationsSchedule(dayjs()));
  const [bookings, setBookings] = useState<ScheduleBooking[]>([]);
  const [servicePosts, setServicePosts] = useState<ServicePost[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [isBookingsLoading, setIsBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [isScheduleLoading, setIsScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [selectedBooking, setSelectedBooking] =
    useState<ScheduleBooking | null>(null);
  const scheduleDays = getScheduleDays(startDate);
  const visibleRange = getVisibleScheduleRange(operationsSchedule);
  const slotStepMinutes = operationsSchedule.slotStepMinutes;
  const desktopSlotStepMinutes = getAllocationAwareSlotStep(
    bookings,
    slotStepMinutes,
  );
  const desktopRowHeight = getSegmentRowHeight(
    desktopSlotStepMinutes,
    slotStepMinutes,
  );
  const slotTimes = createSlotTimes(
    visibleRange.startMinutes,
    visibleRange.endMinutes,
    slotStepMinutes,
  );
  const desktopSlotTimes = createSlotTimes(
    visibleRange.startMinutes,
    visibleRange.endMinutes,
    desktopSlotStepMinutes,
  );
  const rows = createScheduleRows(
    scheduleDays,
    bookings,
    operationsSchedule,
    slotTimes,
  );
  const visiblePosts = servicePosts.filter((post) =>
    selectedPostIds.includes(post.id),
  );
  const desktopRows = createResourceScheduleRows(
    scheduleDays,
    visiblePosts,
    bookings,
    operationsSchedule,
    desktopSlotTimes,
  );
  const desktopScrollX =
    visiblePosts.length > 0
      ? 92 + visiblePosts.length * POST_COLUMN_WIDTH * SCHEDULE_DAYS_COUNT
      : 92 + DAY_COLUMN_WIDTH * SCHEDULE_DAYS_COUNT;

  // Закриває модальне вікно створення бронювання та очищає вибраний слот.
  const closeCreateBookingModal = () => {
    setSelectedSlot(null);
  };

  // Запам'ятовує слот, з якого користувач хоче створити нове бронювання.
  const handleCreateBookingDraft = (day: Dayjs, time: string) => {
    setSelectedSlot({ day, time });
  };

  // Відкриває модальне вікно з деталями бронювання і доступними діями адміністратора.
  const handleOpenBookingDetails = (booking: ScheduleBooking) => {
    setSelectedBooking(booking);
  };

  // Закриває перегляд деталей бронювання.
  const handleCloseBookingDetails = () => {
    setSelectedBooking(null);
  };

  // Тимчасово оновлює статус мок-бронювання, доки дії не підключені до backend API.
  const updateSelectedBookingStatus = (status: BookingStatus) => {
    if (!selectedBooking) {
      return;
    }

    setBookings((currentBookings) =>
      currentBookings.map((booking) =>
        booking.id === selectedBooking.id ? { ...booking, status } : booking,
      ),
    );
    setSelectedBooking((booking) => (booking ? { ...booking, status } : null));
  };

  // Завантажує реальні бронювання з backend і приводить їх до форми розкладу.
  async function loadBookings() {
    setIsBookingsLoading(true);
    setBookingsError(null);

    try {
      const items = await adminRepository.listBookings();
      setBookings(items.map(toScheduleBooking).filter(blocksScheduleSlot));
    } catch (loadError) {
      setBookingsError(
        loadError instanceof Error ? loadError.message : String(loadError),
      );
    } finally {
      setIsBookingsLoading(false);
    }
  }

  // Завантажує робочі вікна з operations domain для поточного діапазону розкладу.
  async function loadOperationsSchedule(dateValue = startDate) {
    setIsScheduleLoading(true);
    setScheduleError(null);

    try {
      const schedule = await adminRepository.getOperationsSchedule(
        getDayKey(dateValue),
        SCHEDULE_DAYS_COUNT,
      );
      setOperationsSchedule(schedule);
    } catch (loadError) {
      setScheduleError(
        loadError instanceof Error ? loadError.message : String(loadError),
      );
      setOperationsSchedule(getDefaultOperationsSchedule(dateValue));
    } finally {
      setIsScheduleLoading(false);
    }
  }

  //! Завантажує список сервісних постів для фільтрації розкладу та створення бронювань на конкретні пости.
  async function loadServicePosts() {
    try {
      const catalog = await adminRepository.getCatalog();
      setServicePosts(catalog.servicePosts);
      setSelectedPostIds((currentPostIds) =>
        currentPostIds.length > 0
          ? currentPostIds
          : catalog.servicePosts.map((post) => post.id),
      );
    } catch {
      setServicePosts([]);
      setSelectedPostIds([]);
    }
  }

  // Тимчасово додає мок-бронювання у стан сторінки після підтвердження в модальному вікні.
  const handleConfirmCreateBookingDraft = () => {
    if (!selectedSlot) {
      return;
    }

    const [hours, minutes] = selectedSlot.time.split(":").map(Number);
    const startsAt = selectedSlot.day
      .hour(hours)
      .minute(minutes)
      .second(0)
      .millisecond(0);
    const endsAt = startsAt.add(60, "minute");

    // TODO: тут буде виклик API створення бронювання після заповнення форми.
    // Поки додаємо мок у стан, щоб перевірити, як таблиця реагує на нові дані.
    setBookings((currentBookings) => [
      ...currentBookings,
      {
        id: Date.now(),
        externalId: `admin-draft-${Date.now()}`,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        status: "new",
        clientType: "retail",
        clientName: "Новий клієнт",
        clientPhone: "",
        vehicleNumber: "",
        serviceTitle: "Нове бронювання",
        vehicleTypeTitle: "",
        postId: "",
        postTitle: "Пост не обрано",
        options: [],
        allocations: [],
        totalPrice: null,
        comment: "",
        admin: "admin",
      },
    ]);

    closeCreateBookingModal();
  };

  // Оновлює початкову дату розкладу після вибору дати в DatePicker.
  const handleDateChange: DatePickerProps["onChange"] = (date) => {
    if (dayjs.isDayjs(date)) {
      setStartDate(date.startOf("day"));
    }
  };

  // Перемикає мобільний одноденний розклад на попередній день.
  const handlePreviousDay = () => {
    setStartDate((currentDate) => currentDate.subtract(1, "day"));
  };

  // Перемикає мобільний одноденний розклад на наступний день.
  const handleNextDay = () => {
    setStartDate((currentDate) => currentDate.add(1, "day"));
  };

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadBookings();
      void loadServicePosts();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadOperationsSchedule(startDate);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [startDate]);

  const columns = createScheduleColumns(
    scheduleDays,
    slotStepMinutes,
    slotStepMinutes,
    handleCreateBookingDraft,
    handleOpenBookingDetails,
  );
  const desktopColumns = createResourceScheduleColumns(
    scheduleDays,
    visiblePosts,
    desktopSlotStepMinutes,
    slotStepMinutes,
    desktopRowHeight,
    handleCreateBookingDraft,
    handleOpenBookingDetails,
  );
  const effectiveDesktopColumns =
    visiblePosts.length > 0 ? desktopColumns : columns;
  const effectiveDesktopRows = visiblePosts.length > 0 ? desktopRows : rows;

  return (
    <>
      <Space className="page-toolbar" wrap style={{ marginBottom: 16 }}>
        <Button
          loading={isBookingsLoading || isScheduleLoading}
          onClick={() => {
            void loadBookings();
            void loadServicePosts();
            void loadOperationsSchedule();
          }}
        >
          Оновити бронювання
        </Button>
        <DatePicker value={startDate} onChange={handleDateChange} />
        {!isMobile && (
          <Select
            mode="multiple"
            maxTagCount="responsive"
            placeholder="Всі пости"
            style={{ minWidth: 260 }}
            value={selectedPostIds}
            options={servicePosts.map((post) => ({
              value: post.id,
              label: post.title,
            }))}
            onChange={setSelectedPostIds}
          />
        )}
      </Space>

      {bookingsError && (
        <Alert
          message="Не вдалося отримати бронювання"
          description={bookingsError}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {scheduleError && (
        <Alert
          message="Не вдалося отримати графік роботи"
          description={scheduleError}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {isMobile ? (
        <ScheduleMobileDayView
          bookings={bookings}
          day={startDate}
          isLoading={isBookingsLoading || isScheduleLoading}
          schedule={operationsSchedule}
          slotStepMinutes={slotStepMinutes}
          slotTimes={slotTimes}
          onCreateBookingDraft={handleCreateBookingDraft}
          onOpenBookingDetails={handleOpenBookingDetails}
          onNextDay={handleNextDay}
          onPreviousDay={handlePreviousDay}
        />
      ) : (
        <ScheduleTableView
          columns={effectiveDesktopColumns}
          isLoading={isBookingsLoading || isScheduleLoading}
          rowHeight={visiblePosts.length > 0 ? desktopRowHeight : SLOT_ROW_HEIGHT}
          rows={effectiveDesktopRows}
          scrollX={desktopScrollX}
        />
      )}

      <AppModal
        isOpen={Boolean(selectedSlot)}
        okText="Створити"
        title="Нове бронювання"
        onCancel={closeCreateBookingModal}
        onConfirm={handleConfirmCreateBookingDraft}
      >
        <Space direction="vertical" size={4}>
          <span>Дата: {selectedSlot?.day.format("DD.MM.YYYY")}</span>
          <span>Час: {selectedSlot?.time}</span>
          <span>// TODO: тут буде форма створення бронювання</span>
        </Space>
      </AppModal>

      <AppModal
        isOpen={Boolean(selectedBooking)}
        okText="Закрити"
        title="Деталі бронювання"
        width={640}
        onCancel={handleCloseBookingDetails}
        onConfirm={handleCloseBookingDetails}
      >
        {selectedBooking && (
          <div className="schedule-booking-details">
            <div className="schedule-booking-details__header">
              <div>
                <h3>{selectedBooking.serviceTitle}</h3>
                <span>
                  {getBookingStart(selectedBooking).format("DD.MM.YYYY HH:mm")}-
                  {getBookingEnd(selectedBooking).format("HH:mm")}
                </span>
              </div>
              <Space size={[6, 6]} wrap>
                <Tag>{bookingStatusLabels[selectedBooking.status]}</Tag>
                <Tag>{bookingClientTypeLabels[selectedBooking.clientType]}</Tag>
              </Space>
            </div>

            <div className="schedule-booking-details__grid">
              <span>Клієнт</span>
              <strong>{selectedBooking.clientName || "Без імені"}</strong>
              <span>Телефон</span>
              <strong>{selectedBooking.clientPhone || "-"}</strong>
              <span>ТЗ</span>
              <strong>{selectedBooking.vehicleNumber || "-"}</strong>
              <span>Тип ТЗ</span>
              <strong>{selectedBooking.vehicleTypeTitle || "-"}</strong>
              <span>Пост</span>
              <strong>{selectedBooking.postTitle || "-"}</strong>
              <span>Сума</span>
              <strong>
                {selectedBooking.totalPrice === null
                  ? "-"
                  : `${selectedBooking.totalPrice} грн`}
              </strong>
              <span>Адмін</span>
              <strong>{selectedBooking.admin || "-"}</strong>
            </div>

            {selectedBooking.options.length > 0 && (
              <div className="schedule-booking-details__section">
                <span>Опції</span>
                <Space size={[4, 4]} wrap>
                  {selectedBooking.options.map((option) => (
                    <Tag key={option.id}>{option.title}</Tag>
                  ))}
                </Space>
              </div>
            )}

            {selectedBooking.comment && (
              <div className="schedule-booking-details__section">
                <span>Коментар</span>
                <p>{selectedBooking.comment}</p>
              </div>
            )}

            <div className="schedule-booking-details__actions">
              <Button icon={<SwapOutlined />}>Перенести</Button>
              <Button icon={<EditOutlined />}>Редагувати</Button>
              {/* <Button
                icon={<CheckCircleOutlined />}
                onClick={() => updateSelectedBookingStatus("done")}
              >
                Виконано
              </Button> */}
              <Button
                icon={<WarningOutlined />}
                onClick={() => updateSelectedBookingStatus("no_show")}
              >
                Не з'явився
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => updateSelectedBookingStatus("canceled")}
              >
                Скасувати бронювання
              </Button>
            </div>
          </div>
        )}
      </AppModal>
    </>
  );
}

export default SchedulePage;
