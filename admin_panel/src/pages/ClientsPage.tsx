import { MessageOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Grid,
  Input,
  message,
  Space,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { adminRepository } from "../api/adminRepository";
import type { ClientListItem } from "../api/types";
import ClientMessageModal from "../components/ClientMessageModal";
import useTableRowsByViewport from "../components/useTableRowsByViewport";

const { Search } = Input;

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function clientMatchesSearch(client: ClientListItem, query: string) {
  if (!query) {
    return true;
  }

  const searchableText = [
    client.fullName,
    client.phone,
    client.username,
    client.telegramUserId?.toString(),
    client.telegramChatId?.toString(),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
}

function createColumns(
  onOpenMessage: (client: ClientListItem) => void,
): ColumnsType<ClientListItem> {
  return [
    {
      title: "Клієнт",
      key: "client",
      render: (_, item) => (
        <Space direction="vertical" size={0}>
          <span>{item.fullName || "Без імені"}</span>
          {item.username && <Tag>@{item.username}</Tag>}
        </Space>
      ),
    },
    {
      title: "Телефон",
      dataIndex: "phone",
      key: "phone",
      render: (value: string) => value || "-",
    },
    {
      title: "Telegram",
      key: "telegram",
      render: (_, item) =>
        item.telegramUserId || item.telegramChatId ? (
          <Space direction="vertical" size={0}>
            {item.username && <Tag>@{item.username}</Tag>}
            <span>ID: {item.telegramUserId ?? "-"}</span>
            <Button
              icon={<MessageOutlined />}
              size="small"
              type="link"
              disabled={!item.telegramChatId}
              onClick={() => onOpenMessage(item)}
            >
              Написати
            </Button>
          </Space>
        ) : (
          "-"
        ),
    },
    {
      title: "Бронювань",
      dataIndex: "bookingsCount",
      key: "bookingsCount",
      align: "right",
    },
    {
      title: "Вперше",
      dataIndex: "firstSeenAt",
      key: "firstSeenAt",
      render: formatDateTime,
    },
    {
      title: "Востаннє був",
      dataIndex: "lastSeenAt",
      key: "lastSeenAt",
      render: formatDateTime,
    },
  ];
}

type ClientsMobileListProps = {
  clients: ClientListItem[];
  isLoading: boolean;
  onOpenMessage: (client: ClientListItem) => void;
};

function ClientsMobileList({
  clients,
  isLoading,
  onOpenMessage,
}: ClientsMobileListProps) {
  if (isLoading) {
    return <Card loading />;
  }

  if (!clients.length) {
    return <Card>Клієнтів не знайдено</Card>;
  }

  return (
    <div className="mobile-card-list">
      {clients.map((client) => (
        <Card className="mobile-data-card" key={client.id} size="small">
          <div className="mobile-data-card__header">
            <div>
              <strong>{client.fullName || "Без імені"}</strong>
              <div className="mobile-data-card__muted">
                {client.phone || "Телефон не вказано"}
              </div>
            </div>
            <Tag>{client.bookingsCount} брон.</Tag>
          </div>

          <div className="mobile-data-card__grid">
            <span>Telegram</span>
            <strong>{client.username ? `@${client.username}` : "-"}</strong>
            <span>User ID</span>
            <strong>{client.telegramUserId ?? "-"}</strong>
            <span>Вперше</span>
            <strong>{formatDateTime(client.firstSeenAt)}</strong>
            <span>Останній раз</span>
            <strong>{formatDateTime(client.lastSeenAt)}</strong>
          </div>

          <Button
            icon={<MessageOutlined />}
            size="small"
            type="link"
            disabled={!client.telegramChatId}
            className="mobile-data-card__action"
            onClick={() => onOpenMessage(client)}
          >
            Написати
          </Button>
        </Card>
      ))}
    </div>
  );
}

function ClientsPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMessageClient, setSelectedMessageClient] =
    useState<ClientListItem | null>(null);
  const [messageText, setMessageText] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const tableRows = useTableRowsByViewport();

  const normalizedSearchQuery = normalizeSearchValue(searchQuery);
  const filteredClients = useMemo(
    () =>
      clients.filter((client) =>
        clientMatchesSearch(client, normalizedSearchQuery),
      ),
    [clients, normalizedSearchQuery],
  );
  const columns = createColumns(openMessageModal);

  async function loadClients() {
    setIsLoading(true);
    setError(null);

    try {
      setClients(await adminRepository.listClients());
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : String(loadError),
      );
    } finally {
      setIsLoading(false);
    }
  }

  function openMessageModal(client: ClientListItem) {
    setSelectedMessageClient(client);
    setMessageText("");
    setMessageError(null);
  }

  function closeMessageModal() {
    setSelectedMessageClient(null);
    setMessageText("");
    setMessageError(null);
  }

  async function sendMessage() {
    if (!selectedMessageClient || isSendingMessage) {
      return;
    }

    const normalizedMessageText = messageText.trim();
    if (!normalizedMessageText) {
      setMessageError("Введіть текст повідомлення");
      return;
    }

    setIsSendingMessage(true);
    setMessageError(null);

    try {
      await adminRepository.sendClientMessage(
        selectedMessageClient.id,
        normalizedMessageText,
      );
      closeMessageModal();
      messageApi.success("Повідомлення надіслано клієнту");
    } catch (sendError) {
      setMessageError(
        sendError instanceof Error ? sendError.message : String(sendError),
      );
    } finally {
      setIsSendingMessage(false);
    }
  }

  useEffect(() => {
    void loadClients();
  }, []);

  return (
    <>
      {contextHolder}

      <Space wrap style={{ marginTop: 8, marginBottom: 16 }}>
        <Button loading={isLoading} onClick={() => void loadClients()}>
          Оновити клієнтів
        </Button>
        <Search
          placeholder="Пошук за іменем, телефоном або Telegram"
          allowClear
          enterButton="Пошук"
          size="middle"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onSearch={setSearchQuery}
          style={{ width: isMobile ? "100%" : 360 }}
        />
      </Space>

      {error && (
        <Alert
          message="Не вдалося отримати клієнтів"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {isMobile ? (
        <ClientsMobileList
          clients={filteredClients}
          isLoading={isLoading}
          onOpenMessage={openMessageModal}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredClients}
          loading={isLoading}
          rowKey="id"
          pagination={{ pageSize: tableRows.pageSize }}
          scroll={{ y: tableRows.scrollY }}
        />
      )}

      <ClientMessageModal
        client={selectedMessageClient}
        error={messageError}
        isOpen={selectedMessageClient !== null}
        isSending={isSendingMessage}
        messageText={messageText}
        onCancel={closeMessageModal}
        onChangeMessageText={setMessageText}
        onSend={() => void sendMessage()}
      />
    </>
  );
}

export default ClientsPage;
