import { Alert, Form, Input, Typography } from "antd";
import type { ClientListItem } from "../api/types";
import AppModal from "./AppModal";

type ClientMessageModalProps = {
  client: ClientListItem | null;
  error: string | null;
  isOpen: boolean;
  isSending: boolean;
  messageText: string;
  onCancel: () => void;
  onChangeMessageText: (value: string) => void;
  onSend: () => void;
};

function ClientMessageModal({
  client,
  error,
  isOpen,
  isSending,
  messageText,
  onCancel,
  onChangeMessageText,
  onSend,
}: ClientMessageModalProps) {
  return (
    <AppModal
      confirmLoading={isSending}
      isOpen={isOpen}
      okText="Надіслати"
      title="Повідомлення клієнту"
      onCancel={onCancel}
      onConfirm={onSend}
    >
      <Form layout="vertical">
        <Typography.Paragraph type="secondary">
          {client
            ? `${client.fullName || "Клієнт без імені"}${
                client.username ? ` (@${client.username})` : ""
              }`
            : "Клієнт не вибраний"}
        </Typography.Paragraph>

        {error && (
          <Alert
            message="Не вдалося надіслати повідомлення"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form.Item label="Текст повідомлення" required>
          <Input.TextArea
            autoFocus
            maxLength={4096}
            placeholder="Введіть повідомлення, яке клієнт отримає у Telegram"
            rows={5}
            showCount
            value={messageText}
            onChange={(event) => onChangeMessageText(event.target.value)}
          />
        </Form.Item>
      </Form>
    </AppModal>
  );
}

export default ClientMessageModal;
