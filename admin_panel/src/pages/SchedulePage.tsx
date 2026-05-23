import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  CheckCircleOutlined,
  CarOutlined,
  IdcardOutlined,
  FileProtectOutlined,
  LeftOutlined,
  LoadingOutlined,
  MoreOutlined,
  PlusOutlined,
  PushpinOutlined,
  PhoneOutlined,
  RightOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Grid,
  Select,
  Space,
  Spin,
  Tag,
  Input,
  notification,
  Tooltip,
} from "antd";
import type { DatePickerProps } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { adminRepository } from "../api/adminRepository";
import type {
  BookingListAllocation,
  BookingListItem,
  BookingListOption,
  OperationsSchedule,
  ServicePost,
  Catalog,
  PricingSummary,
} from "../api/types";
import AppModal from "../components/AppModal";

const SCHEDULE_DAYS_COUNT = 14;
const DEFAULT_WORKDAY_START_MINUTES = 8 * 60;
const DEFAULT_WORKDAY_END_MINUTES = 18 * 60;
const DEFAULT_SLOT_STEP_MINUTES = 15;
const MIN_SEGMENT_STEP_MINUTES = 5;
const GRID_SEGMENT_HEIGHT = 16;
const GRID_TIME_COLUMN_WIDTH = 92;
const GRID_POST_COLUMN_WIDTH = 156;
const AUTO_POST_VALUE = "__auto__";

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

type ScheduleSegment = BookingListAllocation & {
  booking: ScheduleBooking;
  allocations: BookingListAllocation[];
  isGeneral?: boolean;
};

type ScheduleColumn = {
  key: string;
  day: Dayjs;
  post?: ServicePost;
};

type RoutePath = {
  key: string;
  d: string;
};

type SelectedSlot = {
  day: Dayjs;
  post?: ServicePost;
  time: string;
};

type CreateBookingFormValues = {
  serviceId?: string;
  vehicleTypeId?: string;
  preferredPostId?: string;
  clientPhone?: string;
  clientLicensePlate?: string;
  optionIds?: string[];
};

type HoverSlot = SelectedSlot & {
  columnIndex: number;
  rowStart: number;
  rowSpan: number;
};

type ScheduleMobileDayViewProps = {
  bookings: ScheduleBooking[];
  day: Dayjs;
  isLoading: boolean;
  schedule: OperationsSchedule;
  slotTimes: string[];
  onCreateSlot: (slot: SelectedSlot) => void;
  onNextDay: () => void;
  onOpenBooking: (booking: ScheduleBooking) => void;
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

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);

  return hours * 60 + minutes;
}

function getDayKey(day: Dayjs) {
  return day.format("YYYY-MM-DD");
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
      posts: [],
    })),
  };
}

function createSegmentTimes(
  startMinutes: number,
  endMinutes: number,
  stepMinutes: number,
) {
  const result: string[] = [];

  for (
    let current = startMinutes;
    current < endMinutes;
    current += stepMinutes
  ) {
    result.push(minutesToTime(current));
  }

  return result;
}

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

function blocksScheduleSlot(booking: ScheduleBooking) {
  return booking.status !== "canceled";
}

function getBookingStart(booking: ScheduleBooking) {
  return dayjs(booking.startsAt);
}

function getBookingEnd(booking: ScheduleBooking) {
  return dayjs(booking.endsAt);
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

function getAllocationDurationMinutes(allocation: BookingListAllocation) {
  return getAllocationEnd(allocation).diff(
    getAllocationStart(allocation),
    "minute",
  );
}
// ??
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
// ??
function getSegmentStep(
  bookings: ScheduleBooking[],
  fallbackStepMinutes: number,
) {
  const values = bookings.flatMap((booking) =>
    booking.allocations.flatMap((allocation) => [
      timeToMinutes(getAllocationStart(allocation).format("HH:mm")),
      timeToMinutes(getAllocationEnd(allocation).format("HH:mm")),
      getAllocationDurationMinutes(allocation),
    ]),
  );

  const rawStep = values.reduce(
    (currentStep, value) => greatestCommonDivisor(currentStep, value),
    fallbackStepMinutes,
  );

  return Math.max(MIN_SEGMENT_STEP_MINUTES, rawStep);
}

function getScheduleDay(schedule: OperationsSchedule, day: Dayjs) {
  return schedule.days.find((item) => item.date === getDayKey(day));
}

function getWorkingWindowsForPost(
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

function isWorkingSegment(
  schedule: OperationsSchedule,
  day: Dayjs,
  postId: string | undefined,
  time: string,
) {
  const minutes = timeToMinutes(time);

  return getWorkingWindowsForPost(schedule, day, postId).some(
    (window) => window.startMinutes <= minutes && minutes < window.endMinutes,
  );
}

function isSlotInPast(day: Dayjs, time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  return day
    .hour(hours)
    .minute(minutes)
    .second(0)
    .millisecond(0)
    .isBefore(dayjs());
}
// Якщо бронювання має кілька алокацій на одному посту в один день, і вони йдуть підряд, то зливаємо їх в один сегмент для компактного відображення в загальному вигляді.
function mergeAdjacentAllocations(
  booking: ScheduleBooking,
  postId: string,
  dayKey: string,
) {
  const allocations = booking.allocations
    .filter(
      (allocation) =>
        allocation.postId === postId &&
        getAllocationDayKey(allocation) === dayKey,
    )
    .sort((left, right) => {
      const byStart =
        getAllocationStart(left).valueOf() -
        getAllocationStart(right).valueOf();

      return byStart || left.sortOrder - right.sortOrder;
    });
  const segments: ScheduleSegment[] = [];

  allocations.forEach((allocation) => {
    const previousSegment = segments.at(-1);

    if (
      previousSegment &&
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

function getScheduleSegments(bookings: ScheduleBooking[]) {
  return bookings.flatMap((booking) => {
    const keys = new Set(
      booking.allocations.map(
        (allocation) =>
          `${getAllocationDayKey(allocation)}__${allocation.postId}`,
      ),
    );

    return [...keys].flatMap((key) => {
      const [dayKey, postId] = key.split("__");

      return mergeAdjacentAllocations(booking, postId, dayKey);
    });
  });
}

function getGeneralScheduleSegments(bookings: ScheduleBooking[]) {
  return bookings.map((booking) => ({
    id: booking.id,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    sortOrder: 0,
    postId: "",
    postTitle: "",
    serviceTitle: booking.serviceTitle,
    optionTitle: "",
    booking,
    allocations: booking.allocations,
    isGeneral: true,
  }));
}

function getSegmentTitle(segment: ScheduleSegment) {
  if (segment.isGeneral) {
    return segment.booking.serviceTitle;
  }

  return segment.allocations
    .map((allocation) => allocation.optionTitle || allocation.serviceTitle)
    .filter(Boolean)
    .join(" + ");
}

function getSortedAllocations(booking: ScheduleBooking) {
  return [...booking.allocations].sort((left, right) => {
    const byStart =
      getAllocationStart(left).valueOf() - getAllocationStart(right).valueOf();

    return byStart || left.sortOrder - right.sortOrder;
  });
}

function getAllocationTitle(allocation: BookingListAllocation) {
  return allocation.optionTitle || allocation.serviceTitle || "Етап послуги";
}

function getBookingDayKey(booking: ScheduleBooking) {
  return getDayKey(getBookingStart(booking));
}

function getBookingStartTime(booking: ScheduleBooking) {
  return getBookingStart(booking).format("HH:mm");
}

function getBookingDurationMinutes(booking: ScheduleBooking) {
  return getBookingEnd(booking).diff(getBookingStart(booking), "minute");
}

function findBookingForMobileSlot(
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

function getBookingPostsLabel(booking: ScheduleBooking) {
  const postTitles = getSortedAllocations(booking)
    .map((allocation) => allocation.postTitle)
    .filter(Boolean);
  const uniquePostTitles = [...new Set(postTitles)];

  if (uniquePostTitles.length > 0) {
    return uniquePostTitles.join(" -> ");
  }

  return booking.postTitle || "-";
}

function getContractUnavailableText(reason: string) {
  return reason === "vehicle_inactive"
    ? "транспорт у договорі зараз неактивний"
    : reason === "company_inactive"
      ? "компанія за договором зараз неактивна"
      : reason === "contract_not_started"
        ? "договір ще не почав діяти"
        : reason === "contract_expired"
          ? "строк дії договору завершився"
          : reason === "service_offering_not_found"
            ? "для цього типу ТЗ не налаштовано вибрану послугу"
            : "договір зараз неактивний";
}

function formatPrice(value: number | undefined) {
  if (value === undefined) {
    return "-";
  }

  return `${value.toLocaleString("uk-UA")} грн`;
}

function formatDuration(minutes: number | undefined) {
  if (minutes === undefined) {
    return "-";
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours === 0) {
    return `${restMinutes} хв`;
  }

  if (restMinutes === 0) {
    return `${hours} год`;
  }

  return `${hours} год ${restMinutes} хв`;
}

function ScheduleMobileDayView({
  bookings,
  day,
  isLoading,
  schedule,
  slotTimes,
  onCreateSlot,
  onNextDay,
  onOpenBooking,
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
          const booking = findBookingForMobileSlot(bookings, dayKey, time);
          const isBookingStart = booking
            ? getBookingStartTime(booking) === time
            : false;
          const canCreate =
            !booking &&
            isWorkingSegment(schedule, day, undefined, time) &&
            !isSlotInPast(day, time);

          if (booking && !isBookingStart) {
            return null;
          }

          return (
            <div className="schedule-mobile__slot" key={time}>
              <div className="schedule-mobile__time">{time}</div>
              <div className="schedule-mobile__content">
                {booking ? (
                  <button
                    className="schedule-mobile-booking"
                    type="button"
                    onClick={() => onOpenBooking(booking)}
                  >
                    <span className="schedule-mobile-booking__title">
                      {booking.clientType === "contract" && (
                        <FileProtectOutlined />
                      )}
                      {booking.serviceTitle}
                    </span>
                    <span>
                      {getBookingStart(booking).format("HH:mm")}-
                      {getBookingEnd(booking).format("HH:mm")}
                    </span>
                    <strong>
                      {booking.clientName ||
                        booking.vehicleNumber ||
                        "Без імені"}
                    </strong>
                    <span>{getBookingPostsLabel(booking)}</span>
                    {booking.allocations.length > 1 && (
                      <span className="schedule-mobile-booking__stages">
                        {booking.allocations.length} етапи
                      </span>
                    )}
                  </button>
                ) : canCreate ? (
                  <Button
                    block
                    className="schedule-mobile__create"
                    icon={<PlusOutlined />}
                    onClick={() => onCreateSlot({ day, time })}
                  >
                    Новий слот
                  </Button>
                ) : (
                  <span className="schedule-mobile__empty">-</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function makeSegmentKey(segment: ScheduleSegment) {
  return `${segment.booking.id}__${segment.postId || "general"}__${segment.startsAt}`;
}

function makeColumnKey(day: Dayjs, postId?: string) {
  return `${getDayKey(day)}__${postId || "general"}`;
}

// Прив'язує довільну хвилину до початку бізнес-слота.
// Наприклад, якщо слот 15 хв, то 10:07 і 10:14 стануть 10:00, а 10:20 стане 10:15.
function snapMinutesToSlot(minutes: number, slotStepMinutes: number) {
  return Math.floor(minutes / slotStepMinutes) * slotStepMinutes;
}

function getRoutePaths(
  bookings: ScheduleBooking[],
  columnIndexByKey: Map<string, number>,
  visibleRangeStartMinutes: number,
  segmentStepMinutes: number,
) {
  return bookings.flatMap((booking) => {
    const routeAllocations = [...booking.allocations]
      .filter((allocation) => allocation.postId)
      .sort((left, right) => {
        const byStart =
          getAllocationStart(left).valueOf() -
          getAllocationStart(right).valueOf();

        return byStart || left.sortOrder - right.sortOrder;
      });

    if (routeAllocations.length < 2) {
      return [];
    }

    const points = routeAllocations
      .map((allocation) => {
        const columnIndex = columnIndexByKey.get(
          makeColumnKey(getAllocationStart(allocation), allocation.postId),
        );

        if (columnIndex === undefined) {
          return null;
        }

        const startMinutes = timeToMinutes(
          getAllocationStart(allocation).format("HH:mm"),
        );
        const duration = getAllocationDurationMinutes(allocation);
        const startRow =
          (startMinutes - visibleRangeStartMinutes) / segmentStepMinutes;
        const rowSpan = duration / segmentStepMinutes;

        return {
          x:
            GRID_TIME_COLUMN_WIDTH +
            columnIndex * GRID_POST_COLUMN_WIDTH +
            GRID_POST_COLUMN_WIDTH / 2,
          y: (startRow + rowSpan / 2) * GRID_SEGMENT_HEIGHT,
        };
      })
      .filter((point): point is { x: number; y: number } => Boolean(point));

    return points.slice(0, -1).map<RoutePath>((point, index) => {
      const nextPoint = points[index + 1];
      const middleX = (point.x + nextPoint.x) / 2;

      return {
        key: `${booking.id}__route__${index}`,
        d: `M ${point.x} ${point.y} L ${middleX} ${point.y} L ${middleX} ${nextPoint.y} L ${nextPoint.x} ${nextPoint.y}`,
      };
    });
  });
}

function SchedulePage() {
  // External hooks and library state.
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [createBookingForm] = Form.useForm<CreateBookingFormValues>();
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();
  const formControlStyle = useMemo<CSSProperties>(
    () => ({
      minWidth: isMobile ? 0 : 260,
      width: isMobile ? "220px" : "260px",
    }),
    [isMobile],
  );
  const formRowStyle = useMemo<CSSProperties>(
    () => ({
      display: "flex",
      justifyContent: "space-between",
      gap: 8,
      width: "100%",
    }),
    [],
  );

  // Backend data and primary page state.
  const [startDate, setStartDate] = useState(dayjs().startOf("day"));
  const [operationsSchedule, setOperationsSchedule] =
    useState<OperationsSchedule>(() => getDefaultOperationsSchedule(dayjs()));
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [servicePosts, setServicePosts] = useState<ServicePost[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [bookings, setBookings] = useState<ScheduleBooking[]>([]);

  // Modal, hover, loading, and error UI state.
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [hoverSlot, setHoverSlot] = useState<HoverSlot | null>(null);
  const [hoveredBookingExternalId, setHoveredBookingExternalId] = useState<
    string | null
  >(null);
  const [selectedBooking, setSelectedBooking] =
    useState<ScheduleBooking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pricingSummary, setPricingSummary] = useState<PricingSummary | null>(
    null,
  );
  const [isPricingSummaryLoading, setIsPricingSummaryLoading] = useState(false);
  const [pricingSummaryError, setPricingSummaryError] = useState<string | null>(
    null,
  );

  // Refs to DOM nodes used for pointer-to-grid calculations.
  const gridBodyRef = useRef<HTMLDivElement | null>(null);
  const lastPricingLookupNoticeKey = useRef<string | null>(null);

  // Watched create-booking form values.
  const selectedServiceId = Form.useWatch("serviceId", createBookingForm);
  const selectedVehicleTypeId = Form.useWatch(
    "vehicleTypeId",
    createBookingForm,
  );
  const clientLicensePlate = Form.useWatch(
    "clientLicensePlate",
    createBookingForm,
  );
  const watchedOptionIds = Form.useWatch("optionIds", createBookingForm);
  const selectedOptionIds = useMemo(
    () => watchedOptionIds ?? [],
    [watchedOptionIds],
  );

  // Derived create-booking form data.
  const selectedSlotSupportedServiceIds = useMemo(
    () => selectedSlot?.post?.supportedServiceIds ?? [],
    [selectedSlot],
  );

  const selectedSlotDefaultServiceId = useMemo(() => {
    if (!catalog || selectedSlotSupportedServiceIds.length !== 1) {
      return undefined;
    }

    const [serviceId] = selectedSlotSupportedServiceIds;
    return catalog.services.some((service) => service.id === serviceId)
      ? serviceId
      : undefined;
  }, [catalog, selectedSlotSupportedServiceIds]);

  const serviceSelectOptions = useMemo(() => {
    const services = catalog?.services ?? [];
    const supportedServiceIds = new Set(selectedSlotSupportedServiceIds);

    return [...services]
      .sort((left, right) => {
        const leftIsSupported = supportedServiceIds.has(left.id);
        const rightIsSupported = supportedServiceIds.has(right.id);

        if (leftIsSupported === rightIsSupported) {
          return 0;
        }

        return leftIsSupported ? -1 : 1;
      })
      .map((service) => ({
        value: service.id,
        label: service.title,
      }));
  }, [catalog, selectedSlotSupportedServiceIds]);

  const vehicleTypeSelectOptions = useMemo(() => {
    if (!catalog || !selectedServiceId) {
      return [];
    }

    const vehicleTypeIds = catalog.offerings
      .filter((offering) => offering.serviceId === selectedServiceId)
      .map((offering) => offering.vehicleTypeId);

    return catalog.vehicleTypes
      .filter((vehicleType) => vehicleTypeIds.includes(vehicleType.id))
      .map((vehicleType) => ({
        value: vehicleType.id,
        label: vehicleType.title,
      }));
  }, [catalog, selectedServiceId]);

  const selectedOffering = useMemo(() => {
    if (!catalog || !selectedServiceId || !selectedVehicleTypeId) {
      return undefined;
    }

    return catalog.offerings.find(
      (offering) =>
        offering.serviceId === selectedServiceId &&
        offering.vehicleTypeId === selectedVehicleTypeId,
    );
  }, [catalog, selectedServiceId, selectedVehicleTypeId]);

  const serviceOptionSelectOptions = useMemo(() => {
    if (!catalog || !selectedOffering) {
      return [];
    }

    const optionIds = catalog.offeringOptions
      .filter((link) => link.offeringId === selectedOffering.id)
      .map((link) => link.optionId);

    return catalog.options
      .filter((option) => optionIds.includes(option.id))
      .map((option) => ({
        value: option.id,
        label: option.title,
      }));
  }, [catalog, selectedOffering]);

  const postSelectOptions = useMemo(
    () => [
      {
        value: AUTO_POST_VALUE,
        label: "Авто",
      },
      ...servicePosts.map((post) => ({
        value: post.id,
        label: post.title,
        disabled: selectedServiceId
          ? !post.supportedServiceIds.includes(selectedServiceId)
          : false,
      })),
    ],
    [selectedServiceId, servicePosts],
  );

  // Derived schedule data calculated from backend state and current filters.
  const scheduleDays = useMemo(() => getScheduleDays(startDate), [startDate]);
  const visibleRange = useMemo(
    () => getVisibleScheduleRange(operationsSchedule),
    [operationsSchedule],
  );
  const segmentStepMinutes = useMemo(
    () => getSegmentStep(bookings, operationsSchedule.slotStepMinutes),
    [bookings, operationsSchedule.slotStepMinutes],
  );
  const segmentTimes = useMemo(
    () =>
      createSegmentTimes(
        visibleRange.startMinutes,
        visibleRange.endMinutes,
        segmentStepMinutes,
      ),
    [visibleRange.endMinutes, visibleRange.startMinutes, segmentStepMinutes],
  );
  const visiblePosts = useMemo(
    () =>
      selectedPostIds
        .map((postId) => servicePosts.find((post) => post.id === postId))
        .filter((post): post is ServicePost => Boolean(post)),
    [selectedPostIds, servicePosts],
  );
  const isGeneralView = visiblePosts.length === 0;
  const columns = useMemo<ScheduleColumn[]>(() => {
    if (isGeneralView) {
      return scheduleDays.map((day) => ({
        key: makeColumnKey(day),
        day,
      }));
    }

    return scheduleDays.flatMap((day) =>
      visiblePosts.map((post) => ({
        key: makeColumnKey(day, post.id),
        day,
        post,
      })),
    );
  }, [isGeneralView, scheduleDays, visiblePosts]);
  const columnIndexByKey = useMemo(
    () => new Map(columns.map((column, index) => [column.key, index] as const)),
    [columns],
  );
  const segments = useMemo(
    () =>
      isGeneralView
        ? getGeneralScheduleSegments(bookings)
        : getScheduleSegments(bookings),
    [bookings, isGeneralView],
  );
  const routePaths = useMemo(
    () =>
      isGeneralView
        ? []
        : getRoutePaths(
            bookings,
            columnIndexByKey,
            visibleRange.startMinutes,
            segmentStepMinutes,
          ),
    [
      bookings,
      columnIndexByKey,
      isGeneralView,
      segmentStepMinutes,
      visibleRange.startMinutes,
    ],
  );
  const segmentRatio =
    operationsSchedule.slotStepMinutes / Math.max(1, segmentStepMinutes);
  const timeRowSpan = Math.max(1, Math.round(segmentRatio));
  const gridTemplateColumns = `${GRID_TIME_COLUMN_WIDTH}px repeat(${columns.length}, ${GRID_POST_COLUMN_WIDTH}px)`;
  const gridTemplateRows = `repeat(${segmentTimes.length}, ${GRID_SEGMENT_HEIGHT}px)`;
  const totalGridWidth =
    GRID_TIME_COLUMN_WIDTH + columns.length * GRID_POST_COLUMN_WIDTH;
  const gridBodyHeight = segmentTimes.length * GRID_SEGMENT_HEIGHT;

  // Pointer and grid helpers.

  // Перетворює координати миші всередині grid-body на слот розкладу.
  // Важливо: фонова сітка має 5-хв сегменти для точного показу allocation-ів,
  // але створення нової адмінської броні прив'язується до бізнес-слота, наприклад 15 хв.
  function getSlotFromPointer(event: React.MouseEvent<HTMLDivElement>) {
    const gridBody = gridBodyRef.current;
    if (!gridBody) {
      return null;
    }

    const rect = gridBody.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (x < GRID_TIME_COLUMN_WIDTH) {
      return null;
    }

    const columnIndex = Math.floor(
      (x - GRID_TIME_COLUMN_WIDTH) / GRID_POST_COLUMN_WIDTH,
    );
    const timeIndex = Math.floor(y / GRID_SEGMENT_HEIGHT);
    const column = columns[columnIndex];

    if (!column || timeIndex < 0 || timeIndex >= segmentTimes.length) {
      return null;
    }

    const rawMinutes =
      visibleRange.startMinutes + timeIndex * segmentStepMinutes;
    const snappedMinutes = snapMinutesToSlot(
      rawMinutes,
      operationsSchedule.slotStepMinutes,
    );
    const snappedTime = minutesToTime(snappedMinutes);
    const rowStart =
      Math.floor(
        (snappedMinutes - visibleRange.startMinutes) / segmentStepMinutes,
      ) + 1;
    const rowSpan = Math.max(
      1,
      Math.round(operationsSchedule.slotStepMinutes / segmentStepMinutes),
    );
    const postId = column.post?.id;

    if (
      !isWorkingSegment(operationsSchedule, column.day, postId, snappedTime) ||
      isSlotInPast(column.day, snappedTime)
    ) {
      return null;
    }

    return {
      columnIndex,
      day: column.day,
      post: column.post,
      time: snappedTime,
      rowStart,
      rowSpan,
    };
  }

  // Оновлює один легкий overlay замість hover-стану на тисячах клітинок.
  function handleGridPointerMove(event: React.MouseEvent<HTMLDivElement>) {
    const nextHoverSlot = getSlotFromPointer(event);

    setHoverSlot((currentHoverSlot) => {
      if (
        currentHoverSlot &&
        nextHoverSlot &&
        currentHoverSlot.columnIndex === nextHoverSlot.columnIndex &&
        currentHoverSlot.rowStart === nextHoverSlot.rowStart
      ) {
        return currentHoverSlot;
      }

      return nextHoverSlot;
    });
  }

  function handleGridPointerLeave() {
    setHoverSlot(null);
  }

  // Клік використовує той самий snapped слот, що й hover, тому адміністратор
  // бачить саме той 15-хв початок, який буде передано у модалку створення.
  function handleGridBackgroundClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    const clickedSlot = getSlotFromPointer(event);
    if (clickedSlot) {
      setSelectedSlot({
        day: clickedSlot.day,
        post: clickedSlot.post,
        time: clickedSlot.time,
      });
    }
  }

  // Backend loading and page refresh.
  async function loadPage(dateValue = startDate) {
    setIsLoading(true);
    setError(null);

    try {
      const [bookingItems, schedule, catalogPayload] = await Promise.all([
        adminRepository.listBookings(),
        adminRepository.getOperationsSchedule(
          getDayKey(dateValue),
          SCHEDULE_DAYS_COUNT,
        ),
        adminRepository.getCatalog(),
      ]);

      const nextPosts = catalogPayload.servicePosts;

      setCatalog(catalogPayload);
      setBookings(
        bookingItems.map(toScheduleBooking).filter(blocksScheduleSlot),
      );
      setOperationsSchedule(schedule);
      setServicePosts(nextPosts);
      setSelectedPostIds((currentIds) =>
        currentIds.length > 0 ? currentIds : nextPosts.map((post) => post.id),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : String(loadError),
      );
      setOperationsSchedule(getDefaultOperationsSchedule(dateValue));
    } finally {
      setIsLoading(false);
    }
  }

  // Effects that synchronize page state with external changes.
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadPage(startDate);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [startDate]);

  useEffect(() => {
    if (!selectedSlot) {
      createBookingForm.resetFields();
      return;
    }

    createBookingForm.setFieldsValue({
      serviceId: selectedSlotDefaultServiceId,
      vehicleTypeId: undefined,
      optionIds: [],
      preferredPostId: selectedSlot.post?.id ?? AUTO_POST_VALUE,
      clientLicensePlate: undefined,
    });
    lastPricingLookupNoticeKey.current = null;
    setPricingSummary(null);
    setPricingSummaryError(null);
    setIsPricingSummaryLoading(false);
  }, [createBookingForm, selectedSlot, selectedSlotDefaultServiceId]);

  useEffect(() => {
    if (!selectedSlot || !selectedServiceId) {
      return;
    }

    const preferredPostId = createBookingForm.getFieldValue("preferredPostId");
    if (!preferredPostId || preferredPostId === AUTO_POST_VALUE) {
      return;
    }

    const preferredPost = servicePosts.find(
      (post) => post.id === preferredPostId,
    );
    if (
      preferredPost &&
      !preferredPost.supportedServiceIds.includes(selectedServiceId)
    ) {
      createBookingForm.setFieldsValue({
        preferredPostId: AUTO_POST_VALUE,
      });
    }
  }, [createBookingForm, selectedServiceId, selectedSlot, servicePosts]);

  useEffect(() => {
    if (!selectedSlot || !selectedServiceId) {
      lastPricingLookupNoticeKey.current = null;
      setPricingSummary(null);
      setPricingSummaryError(null);
      setIsPricingSummaryLoading(false);
      return;
    }

    const vehicleNumber = clientLicensePlate?.trim().toUpperCase() ?? "";
    const hasVehicleNumberForLookup = vehicleNumber.length >= 3;
    const canResolvePricing =
      Boolean(selectedVehicleTypeId) || hasVehicleNumberForLookup;
    if (!canResolvePricing) {
      lastPricingLookupNoticeKey.current = null;
      setPricingSummary(null);
      setPricingSummaryError(null);
      setIsPricingSummaryLoading(false);
      return;
    }

    let isStale = false;
    setIsPricingSummaryLoading(true);
    setPricingSummaryError(null);

    const timerId = window.setTimeout(() => {
      adminRepository
        .resolvePricing({
          serviceId: selectedServiceId,
          vehicleTypeId: selectedVehicleTypeId,
          vehicleNumber: hasVehicleNumberForLookup ? vehicleNumber : undefined,
          billingMode: "auto",
          optionIds: selectedOptionIds,
        })
        .then((summary) => {
          if (isStale) {
            return;
          }

          setPricingSummary(summary);
          const contractVehicle = summary.vehicle;
          if (contractVehicle) {
            const currentVehicleNumber =
              createBookingForm.getFieldValue("clientLicensePlate");
            if (
              contractVehicle.vehicleNumber &&
              currentVehicleNumber !== contractVehicle.vehicleNumber
            ) {
              createBookingForm.setFieldsValue({
                clientLicensePlate: contractVehicle.vehicleNumber,
              });
            }

            if (
              contractVehicle.vehicleTypeId &&
              createBookingForm.getFieldValue("vehicleTypeId") !==
                contractVehicle.vehicleTypeId
            ) {
              createBookingForm.setFieldsValue({
                vehicleTypeId: contractVehicle.vehicleTypeId,
                optionIds: [],
              });
            }
          }

          const noticeKey = [
            selectedServiceId,
            summary.contractFound ? "contract" : "retail",
            summary.contractUnavailableReason ?? "ok",
            summary.vehicle?.vehicleNumber ?? vehicleNumber,
          ].join("__");
          if (lastPricingLookupNoticeKey.current !== noticeKey) {
            lastPricingLookupNoticeKey.current = noticeKey;

            if (summary.contractFound && summary.contract) {
              notificationApi.success({
                message: `Контракт: ${summary.contract.companyTitle} / ${summary.contract.number}`,
                description: summary.vehicle?.vehicleTypeTitle
                  ? `Тип ТЗ визначено автоматично: ${summary.vehicle.vehicleTypeTitle}`
                  : undefined,
                placement: "topRight",
              });
            } else if (
              summary.contractMatched &&
              summary.contractUnavailableReason
            ) {
              notificationApi.warning({
                message: "Номер знайдено в контрактних даних",
                description: `Але ${getContractUnavailableText(
                  summary.contractUnavailableReason,
                )}. Тип ТЗ підставлено, запис продовжуємо як retail.`,
                placement: "topRight",
              });
            }
          }
        })
        .catch((lookupError) => {
          if (isStale) {
            return;
          }

          setPricingSummary(null);
          setPricingSummaryError(
            lookupError instanceof Error
              ? lookupError.message
              : String(lookupError),
          );
          notificationApi.warning({
            message: "Не вдалося перевірити номер у контрактах",
            description:
              lookupError instanceof Error
                ? lookupError.message
                : String(lookupError),
            placement: "topRight",
          });
        })
        .finally(() => {
          if (!isStale) {
            setIsPricingSummaryLoading(false);
          }
        });
    }, 500);

    return () => {
      isStale = true;
      window.clearTimeout(timerId);
    };
  }, [
    clientLicensePlate,
    createBookingForm,
    notificationApi,
    selectedOptionIds,
    selectedServiceId,
    selectedSlot,
    selectedVehicleTypeId,
  ]);

  // Toolbar and navigation event handlers.
  const handleDateChange: DatePickerProps["onChange"] = (date) => {
    if (dayjs.isDayjs(date)) {
      setStartDate(date.startOf("day"));
    }
  };

  const handlePreviousDay = () => {
    setStartDate((currentDate) => currentDate.subtract(1, "day"));
  };

  const handleNextDay = () => {
    setStartDate((currentDate) => currentDate.add(1, "day"));
  };

  const resetPostOrder = () => {
    setSelectedPostIds(servicePosts.map((post) => post.id));
  };

  // Render.
  return (
    <>
      {notificationContextHolder}
      <Space className="page-toolbar" wrap style={{ marginBottom: 16 }}>
        <Button loading={isLoading} onClick={() => void loadPage()}>
          Оновити бронювання
        </Button>
        <DatePicker value={startDate} onChange={handleDateChange} />
        {!isMobile && (
          <Select
            mode="multiple"
            maxTagCount="responsive"
            placeholder="Пости"
            style={{ minWidth: 260 }}
            value={selectedPostIds}
            options={servicePosts.map((post) => ({
              value: post.id,
              label: post.title,
            }))}
            onChange={setSelectedPostIds}
          />
        )}
        {!isMobile && selectedPostIds.length > 0 && (
          <Button onClick={resetPostOrder}>Скинути порядок</Button>
        )}
      </Space>

      {error && (
        <Alert
          message="Не вдалося отримати дані розкладу"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {isMobile ? (
        <ScheduleMobileDayView
          bookings={bookings}
          day={startDate}
          isLoading={isLoading}
          schedule={operationsSchedule}
          slotTimes={segmentTimes}
          onCreateSlot={setSelectedSlot}
          onNextDay={handleNextDay}
          onOpenBooking={setSelectedBooking}
          onPreviousDay={handlePreviousDay}
        />
      ) : (
        <div className="schedule-grid-shell">
          <div className="schedule-grid-scroll">
            <div
              className="schedule-grid-header"
              style={{
                gridTemplateColumns,
                minWidth: totalGridWidth,
              }}
            >
              <div className="schedule-grid-header__time">Час</div>
              {columns.map((column) => (
                <div className="schedule-grid-header__post" key={column.key}>
                  <span>{column.day.format("dd DD.MM")}</span>
                  <strong>{column.post?.title ?? ""}</strong>
                </div>
              ))}
            </div>

            <div
              ref={gridBodyRef}
              className="schedule-grid-body"
              style={
                {
                  gridTemplateColumns,
                  gridTemplateRows,
                  minWidth: totalGridWidth,
                  minHeight: gridBodyHeight,
                  "--schedule-grid-time-column-width": `${GRID_TIME_COLUMN_WIDTH}px`,
                  "--schedule-grid-post-column-width": `${GRID_POST_COLUMN_WIDTH}px`,
                  "--schedule-grid-segment-height": `${GRID_SEGMENT_HEIGHT}px`,
                } as CSSProperties
              }
              onClick={handleGridBackgroundClick}
              onMouseLeave={handleGridPointerLeave}
              onMouseMove={handleGridPointerMove}
            >
              {segmentTimes.map((time, timeIndex) => {
                const showTime =
                  timeToMinutes(time) % operationsSchedule.slotStepMinutes ===
                  0;

                if (!showTime) {
                  return null;
                }

                return (
                  <div
                    className="schedule-grid-time-label"
                    key={`time-${time}`}
                    style={{
                      gridColumn: 1,
                      gridRow: `${timeIndex + 1} / span ${timeRowSpan}`,
                    }}
                  >
                    {time}
                  </div>
                );
              })}

              {hoverSlot && (
                <div
                  className="schedule-grid-hover-slot"
                  style={{
                    gridColumn: hoverSlot.columnIndex + 2,
                    gridRow: `${hoverSlot.rowStart} / span ${hoverSlot.rowSpan}`,
                  }}
                >
                  {hoverSlot.time}
                </div>
              )}

              {routePaths.length > 0 && (
                <svg
                  className="schedule-grid-routes"
                  height={gridBodyHeight}
                  viewBox={`0 0 ${totalGridWidth} ${gridBodyHeight}`}
                  width={totalGridWidth}
                  aria-hidden="true"
                >
                  {routePaths.map((route) => (
                    <path
                      className="schedule-grid-route"
                      d={route.d}
                      key={route.key}
                    />
                  ))}
                </svg>
              )}

              {segments.map((segment) => {
                const columnIndex = columnIndexByKey.get(
                  makeColumnKey(
                    getAllocationStart(segment),
                    isGeneralView ? undefined : segment.postId,
                  ),
                );

                if (columnIndex === undefined) {
                  return null;
                }

                const startOffset =
                  timeToMinutes(getAllocationStart(segment).format("HH:mm")) -
                  visibleRange.startMinutes;
                const duration = getAllocationDurationMinutes(segment);
                const startRow =
                  Math.floor(startOffset / segmentStepMinutes) + 1;
                const rowSpan = Math.max(
                  1,
                  Math.ceil(duration / segmentStepMinutes),
                );
                const isContractBooking =
                  segment.booking.clientType === "contract";
                const isRelatedBookingHovered =
                  Boolean(segment.booking.externalId) &&
                  segment.booking.externalId === hoveredBookingExternalId;

                return (
                  <button
                    className={`schedule-grid-booking${
                      isRelatedBookingHovered
                        ? " schedule-grid-booking_related-hover"
                        : ""
                    }`}
                    key={makeSegmentKey(segment)}
                    style={{
                      gridColumn: columnIndex + 2,
                      gridRow: `${startRow} / span ${rowSpan}`,
                    }}
                    type="button"
                    onClick={() => setSelectedBooking(segment.booking)}
                    onBlur={() => setHoveredBookingExternalId(null)}
                    onFocus={() =>
                      setHoveredBookingExternalId(
                        segment.booking.externalId || null,
                      )
                    }
                    onMouseEnter={() =>
                      setHoveredBookingExternalId(
                        segment.booking.externalId || null,
                      )
                    }
                    onMouseLeave={() => setHoveredBookingExternalId(null)}
                  >
                    <div className="schedule-grid-booking__header">
                      <span className="schedule-grid-booking__title">
                        {isContractBooking && <FileProtectOutlined />}
                        {getSegmentTitle(segment)}
                      </span>
                    </div>
                    <span>{getAllocationStart(segment).format("HH:mm")}</span>
                    <span>
                      {segment.booking.clientName ||
                        segment.booking.vehicleNumber}
                    </span>
                    <span className="schedule-grid-booking__stages">
                      {segment.allocations.map((allocation) => (
                        <Tag key={allocation.id}>
                          {allocation.optionTitle || allocation.serviceTitle}
                        </Tag>
                      ))}
                    </span>
                    <MoreOutlined className="schedule-grid-booking__icon" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Модалка нового бронювання відкривається на слоті з уже прив'язаною датою, часом і постом (якщо є), щоб адміністратор бачив, що саме він створює. */}
      <AppModal
        isOpen={Boolean(selectedSlot)}
        okText="Створити запис"
        title="Створити бронювання"
        onCancel={() => setSelectedSlot(null)}
        onConfirm={() => setSelectedSlot(null)}
      >
        <Form form={createBookingForm} layout="vertical">
          <Space orientation="vertical" size={6} style={{ width: "100%" }}>
            {/* Дата послуга */}
            <Card
              size="small"
              title={`Запис на ${selectedSlot?.day.format("DD.MM.YYYY")} ${selectedSlot?.time} `}
            >
              <Space
                orientation="vertical"
                style={{ width: "100%" }}
                size={isMobile ? 4 : 8}
              >
                <Space orientation="horizontal" size={8} style={formRowStyle}>
                  {isMobile ? (
                    <Tooltip title="Послуга">
                      <ShoppingCartOutlined aria-label="Послуга" />
                    </Tooltip>
                  ) : (
                    <span>Послуга:</span>
                  )}
                  {/* <span>Пост: {selectedSlot?.post?.title ?? "Не обрано"}</span> */}
                  <Form.Item name="serviceId" style={{ marginBottom: 0 }}>
                    <Select
                      placeholder="Оберіть послугу"
                      style={formControlStyle}
                      size={isMobile ? "medium" : "large"}
                      value={undefined}
                      options={serviceSelectOptions}
                      onChange={() => {
                        createBookingForm.setFieldsValue({
                          vehicleTypeId: undefined,
                          optionIds: [],
                        });
                      }}
                    ></Select>
                  </Form.Item>
                </Space>
                <Space orientation="horizontal" style={formRowStyle} size={8}>
                  {isMobile ? (
                    <Tooltip title="Основний пост">
                      <PushpinOutlined aria-label="Основний пост" />
                    </Tooltip>
                  ) : (
                    <span>Основний пост:</span>
                  )}
                  <Form.Item name="preferredPostId" style={{ marginBottom: 0 }}>
                    <Select
                      placeholder="Оберіть пост"
                      style={formControlStyle}
                      size={isMobile ? "medium" : "large"}
                      options={postSelectOptions}
                      disabled={!selectedServiceId}
                    ></Select>
                  </Form.Item>
                </Space>
              </Space>
            </Card>
            {/* Клієнт */}
            <Card size="small" title="Дані клієнта:">
              <Space
                orientation="vertical"
                size={isMobile ? 4 : 8}
                style={{ width: "100%" }}
              >
                <Space orientation="horizontal" size={8} style={formRowStyle}>
                  {isMobile ? (
                    <Tooltip title="Телефон">
                      <PhoneOutlined aria-label="Телефон" />
                    </Tooltip>
                  ) : (
                    <span>Тел.:</span>
                  )}
                  <Form.Item name="clientPhone" style={{ marginBottom: 0 }}>
                    <Input
                      style={formControlStyle}
                      size={isMobile ? "medium" : "large"}
                      type="tel"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="+380 XX XXX XX XX"
                    />
                  </Form.Item>
                </Space>
                <Space orientation="horizontal" size={8} style={formRowStyle}>
                  {isMobile ? (
                    <Tooltip title="Реєстраційний номер">
                      <IdcardOutlined aria-label="Реєстраційний номер" />
                    </Tooltip>
                  ) : (
                    <span>Реєстраційний номер:</span>
                  )}
                  <Form.Item
                    name="clientLicensePlate"
                    style={{ marginBottom: 0 }}
                  >
                    <Input
                      placeholder="AА1234ЯЯ"
                      size={isMobile ? "medium" : "large"}
                      style={{
                        ...formControlStyle,
                        textTransform: "uppercase",
                      }}
                    />
                  </Form.Item>
                </Space>
                <Space orientation="horizontal" size={8} style={formRowStyle}>
                  {isMobile ? (
                    <Tooltip title="Тип ТЗ">
                      <CarOutlined aria-label="Тип ТЗ" />
                    </Tooltip>
                  ) : (
                    <span>Тип ТЗ:</span>
                  )}
                  <Form.Item name="vehicleTypeId" style={{ marginBottom: 0 }}>
                    <Select
                      placeholder="Оберіть тип ТЗ"
                      style={formControlStyle}
                      size={isMobile ? "medium" : "large"}
                      options={vehicleTypeSelectOptions}
                      disabled={!selectedServiceId}
                      onChange={() => {
                        createBookingForm.setFieldsValue({
                          optionIds: [],
                        });
                      }}
                    ></Select>
                  </Form.Item>
                </Space>
              </Space>
            </Card>
            {/* Додаткові послуги */}
            {/* {selectedVehicleTypeId && serviceOptionSelectOptions.length > 0 && ( */}
            <Card size="small" title="Додаткові опції:">
              <Form.Item name="optionIds" style={{ marginBottom: 0 }}>
                <Select
                  mode="multiple"
                  size={isMobile ? "medium" : "large"}
                  placeholder="Оберіть додаткові опції"
                  // style={formControlStyle}
                  options={serviceOptionSelectOptions}
                  disabled={!selectedOffering}
                ></Select>
              </Form.Item>
            </Card>
            {/* )} */}
            <Card size="small" title="Підсумок:">
              <Space
                orientation="vertical"
                size={isMobile ? 4 : 8}
                style={{ width: "100%" }}
              >
                <Space
                  orientation="horizontal"
                  size={8}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <Space size={4}>
                    <span>Режим:</span>
                    <Tag
                      color={
                        pricingSummary?.billingMode === "contract"
                          ? "green"
                          : "default"
                      }
                    >
                      {pricingSummary?.billingMode === "contract"
                        ? "Контракт"
                        : "Retail"}
                    </Tag>
                  </Space>

                  <Space size={4}>
                    <span>Час:</span>
                    <strong>
                      {isPricingSummaryLoading ? (
                        <Spin
                          indicator={<LoadingOutlined spin />}
                          size="small"
                        />
                      ) : (
                        formatDuration(pricingSummary?.totalDurationMinutes)
                      )}
                    </strong>
                  </Space>

                  <Space size={4}>
                    <span>Вартість:</span>
                    <strong>
                      {isPricingSummaryLoading ? (
                        <Spin
                          indicator={<LoadingOutlined spin />}
                          size="small"
                        />
                      ) : (
                        formatPrice(pricingSummary?.totalPrice)
                      )}
                    </strong>
                  </Space>
                </Space>

                {pricingSummaryError && (
                  <span style={{ color: "var(--app-danger, #b91c1c)" }}>
                    {pricingSummaryError}
                  </span>
                )}
              </Space>
            </Card>
          </Space>
        </Form>
      </AppModal>

      <AppModal
        isOpen={Boolean(selectedBooking)}
        okText="Закрити"
        title="Деталі бронювання"
        width={640}
        onCancel={() => setSelectedBooking(null)}
        onConfirm={() => setSelectedBooking(null)}
      >
        {selectedBooking && (
          <div className="schedule-grid-details">
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
            <div className="schedule-grid-details__timeline">
              <div className="schedule-grid-details__timeline-line" />
              {getSortedAllocations(selectedBooking).map((allocation) => (
                <div
                  className="schedule-grid-details__timeline-point"
                  key={allocation.id}
                >
                  <span className="schedule-grid-details__timeline-dot" />
                  <strong>{getAllocationTitle(allocation)}</strong>
                  <span>
                    {getAllocationStart(allocation).format("HH:mm")}-
                    {getAllocationEnd(allocation).format("HH:mm")}
                    {allocation.postTitle ? ` · ${allocation.postTitle}` : ""}
                  </span>
                </div>
              ))}
              <div className="schedule-grid-details__timeline-point schedule-grid-details__timeline-point_end">
                <span className="schedule-grid-details__timeline-dot">
                  <CheckCircleOutlined />
                </span>
                <span>{getBookingEnd(selectedBooking).format("HH:mm")}</span>
              </div>
            </div>
            <div className="schedule-grid-details__grid">
              <span>Клієнт</span>
              <strong>{selectedBooking.clientName || "Без імені"}</strong>
              <span>Телефон</span>
              <strong>{selectedBooking.clientPhone || "-"}</strong>
              <span>ТЗ</span>
              <strong>{selectedBooking.vehicleNumber || "-"}</strong>
              <span>Тип ТЗ</span>
              <strong>{selectedBooking.vehicleTypeTitle || "-"}</strong>
            </div>
          </div>
        )}
      </AppModal>
    </>
  );
}

export default SchedulePage;
