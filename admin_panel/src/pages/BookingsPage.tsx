import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Grid,
  Input,
  Modal,
  message,
  Space,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { adminRepository } from "../api/adminRepository";
import type { BookingListItem, BookingListOption } from "../api/types";
import useTableRowsByViewport from "../components/useTableRowsByViewport";

const statusLabels: Record<string, string> = {
  new: "Нове",
  confirmed: "Підтверджене",
  canceled: "Скасоване",
  done: "Виконане",
  no_show: "Не з'явився",
  past: "Минуле",
};

function isPastBooking(item: BookingListItem) {
  return new Date(item.endsAt) < new Date();
}

function formatBookingDateTime(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function renderBookingOptions(options: BookingListOption[] | undefined) {
  return options?.length ? (
    <Space size={[4, 4]} wrap>
      {options.map((option) => (
        <Tag key={option.id} color="default">
          {option.title}
        </Tag>
      ))}
    </Space>
  ) : (
    "-"
  );
}

type BookingsMobileListProps = {
  bookings: BookingListItem[];
  isLoading: boolean;
  onCancelBooking: (item: BookingListItem) => void;
  onMarkNoShow: (item: BookingListItem) => void;
};

function BookingsMobileList({
  bookings,
  isLoading,
  onCancelBooking,
  onMarkNoShow,
}: BookingsMobileListProps) {
  if (isLoading) {
    return <Card loading />;
  }

  if (!bookings.length) {
    return <Card>Бронювання не знайдено</Card>;
  }

  return (
    <div className="mobile-card-list">
      {bookings.map((item) => {
        const isPast = isPastBooking(item);

        return (
          <Card className="mobile-data-card" key={item.id} size="small">
            <div className="mobile-data-card__header">
              <div>
                <strong>{formatBookingDateTime(item.startsAt)}</strong>
                <div className="mobile-data-card__muted">
                  {item.serviceTitle}
                </div>
              </div>
              <Tag>{statusLabels[item.status] ?? item.status}</Tag>
            </div>

            <div className="mobile-data-card__grid">
              <span>Клієнт</span>
              <strong>
                {item.clientPhone || item.clientName || "Без імені"}
              </strong>
              <span>ТЗ</span>
              <strong>{item.vehicleNumber || "-"}</strong>
              <span>Пост</span>
              <strong>{item.postTitle || "-"}</strong>
              <span>Сума</span>
              <strong>
                {item.totalPrice === null ? "-" : `${item.totalPrice} грн`}
              </strong>
            </div>

            <div className="mobile-data-card__options">
              {renderBookingOptions(item.options)}
            </div>

            <Space wrap>
              {isPast ? (
                <Button
                  size="small"
                  disabled={
                    item.status !== "new" && item.status !== "confirmed"
                  }
                  onClick={() => onMarkNoShow(item)}
                >
                  Не з'явився
                </Button>
              ) : (
                <Button
                  danger
                  size="small"
                  disabled={item.status === "canceled"}
                  onClick={() => onCancelBooking(item)}
                >
                  Скасувати
                </Button>
              )}
            </Space>
          </Card>
        );
      })}
    </div>
  );
}

function BookingsPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedBooking, setSelectedBooking] =
    useState<BookingListItem | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const tableRows = useTableRowsByViewport();

  const columns: ColumnsType<BookingListItem> = [
    {
      title: "Дата і час",
      dataIndex: "startsAt",
      key: "startsAt",
      render: (value: string) =>
        new Intl.DateTimeFormat("uk-UA", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(value)),
    },
    {
      title: "Клієнт",
      key: "client",
      width: 140,
      render: (_, item) => item.clientPhone || item.clientName || "Без імені",
    },
    {
      title: "Номер ТЗ",
      dataIndex: "vehicleNumber",
      key: "vehicleNumber",
    },
    {
      title: "Послуга",
      dataIndex: "serviceTitle",
      key: "serviceTitle",
    },
    {
      title: "Пост",
      dataIndex: "postTitle",
      key: "postTitle",
      render: (value: string) => value || "-",
    },
    {
      title: "Опції",
      // dataIndex бере item.options з BookingListItem, який приходить з backend API.
      dataIndex: "options",
      key: "options",

      render: (options: BookingListOption[] | undefined) =>
        options?.length ? (
          <Space size={[4, 4]} wrap>
            {options.map((option) => (
              <Tag key={option.id} color={"default"}>
                {option.title}
              </Tag>
            ))}
          </Space>
        ) : (
          "-"
        ),
    },
    {
      title: "Статус",
      dataIndex: "status",
      key: "status",
      render: (value: string) => {
        // const isPast = isPastBooking(item);

        return (
          <Space size={[4, 4]} wrap>
            <Tag>{statusLabels[value] ?? value}</Tag>

            {/* {isPast &&
              value !== "canceled" &&
              value !== "done" &&
              value !== "no_show" && <Tag color="orange">Минуле</Tag>} */}
          </Space>
        );
      },
    },
    {
      title: "Сума",
      dataIndex: "totalPrice",
      key: "totalPrice",
      align: "right",
      render: (value: number | null) => (value === null ? "-" : `${value} грн`),
    },
    {
      title: "Дії",
      key: "actions",
      align: "right",

      render: (_, item) => {
        const isPast = isPastBooking(item);

        return (
          <Space>
            {isPast ? (
              <Button
                size="small"
                disabled={item.status !== "new" && item.status !== "confirmed"}
                onClick={() => void markNoShow(item)}
              >
                Не з&apos;явився
              </Button>
            ) : (
              <Button
                type="primary"
                size="small"
                disabled={item.status === "canceled"}
                onClick={() => {
                  openCancelModal(item);
                }}
              >
                Скасувати
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  async function loadBookings() {
    setIsLoading(true);
    setError(null);

    try {
      setBookings(await adminRepository.listBookings());
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : String(loadError),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function markNoShow(item: BookingListItem) {
    try {
      await adminRepository.markNoShow(item.id);
      await loadBookings();
      messageApi.open({
        type: "warning",
        content: "Бронювання позначено як no-show",
      });
    } catch (markError) {
      messageApi.open({
        type: "error",
        content:
          markError instanceof Error ? markError.message : String(markError),
      });
    }
  }

  function openCancelModal(item: BookingListItem) {
    setSelectedBooking(item);
    setCancelReason("");
    setIsCancelModalOpen(true);
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadBookings();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, []);

  return (
    <div className="page-fill">
      {contextHolder}
      {/* <h1 className="page-title">Бронювання</h1>
      <p className="page-description">
        Список останніх бронювань, отриманий з backend API.
      </p> */}

      <Space className="page-toolbar" wrap style={{ marginBottom: 16 }}>
        <Button loading={isLoading} onClick={() => void loadBookings()}>
          Оновити бронювання
        </Button>
      </Space>

      {error && (
        <Alert
          message="Не вдалося отримати бронювання"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <div className="page-table">
        {/* <ConfigProvider
          theme={{
            components: {
              Table: {
                headerBg: "#1f2937",
                headerColor: "#ffffff",
                // rowHoverBg: "#f3f4f6",
              },
            },
          }}
        > */}
        {isMobile ? (
          <BookingsMobileList
            bookings={bookings}
            isLoading={isLoading}
            onCancelBooking={openCancelModal}
            onMarkNoShow={(item) => void markNoShow(item)}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={bookings}
            loading={isLoading}
            rowKey="id"
            pagination={{ pageSize: tableRows.pageSize }}
            scroll={{ y: tableRows.scrollY }}
          />
        )}
        {/* </ConfigProvider> */}
      </div>
      <Modal
        title="Скасувати бронювання"
        open={isCancelModalOpen}
        okText="Скасувати бронювання"
        cancelText="Назад"
        okButtonProps={{ danger: true }}
        onOk={() => {
          if (!selectedBooking) {
            return;
          }

          void adminRepository
            .cancelBooking(selectedBooking.id, cancelReason)
            .then(() => {
              setIsCancelModalOpen(false);
              setSelectedBooking(null);
              setCancelReason("");
              void loadBookings();
              messageApi.open({
                type: "warning",
                content: "Бронювання успішно скасовано",
              });
            });
        }}
        onCancel={() => {
          setIsCancelModalOpen(false);
          setSelectedBooking(null);
          setCancelReason("");
        }}
      >
        <Input.TextArea
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          placeholder="Причина скасування (необов'язково)"
          rows={3}
        />
      </Modal>
    </div>
  );
}

export default BookingsPage;
