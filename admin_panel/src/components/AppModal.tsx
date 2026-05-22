import type { ReactNode } from "react";
import { Modal } from "antd";

type AppModalProps = {
  children: ReactNode;
  confirmLoading?: boolean;
  isOpen: boolean;
  okText?: string;
  title: string;
  width?: number;
  onCancel: () => void;
  onConfirm?: () => void;
};

function AppModal({
  children,
  confirmLoading = false,
  isOpen,
  okText = "Зберегти",
  title,
  width = 560,
  onCancel,
  onConfirm,
}: AppModalProps) {
  return (
    <Modal
      centered
      confirmLoading={confirmLoading}
      destroyOnHidden
      okText={okText}
      open={isOpen}
      title={title}
      width={width}
      cancelText="Скасувати"
      onCancel={onCancel}
      onOk={onConfirm}
    >
      {children}
    </Modal>
  );
}

export default AppModal;
