import { useEffect, useState } from "react";
import { Alert, Button, Card, Space, Statistic } from "antd";
import AppModal from "../components/AppModal";
import { adminRepository } from "../api/adminRepository";
import type {
  Catalog,
  ClientListItem,
  ContractStats,
  BookingStats,
} from "../api/types";

type StatCardProps = {
  error?: string | null;
  loading?: boolean;
  title: string;
  value: number;
};

function StatCard({ error, loading, title, value }: StatCardProps) {
  return (
    <Card loading={loading}>
      {error ? (
        <Alert message={`${title} недоступні`} type="error" showIcon />
      ) : (
        <Statistic title={title} value={value} />
      )}
    </Card>
  );
}

function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [contractStats, setContractStats] = useState<ContractStats | null>(
    null,
  );
  const [booking_stats, setBookingStats] = useState<BookingStats | null>(null);

  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isClientsLoading, setIsClientsLoading] = useState(true);
  const [isContractStatsLoading, setIsContractStatsLoading] = useState(true);
  const [isBookingStatsLoading, setIsBookingStatsLoading] = useState(true);

  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [contractStatsError, setContractStatsError] = useState<string | null>(
    null,
  );
  const [bookingStatsError, setBookingStatsError] = useState<string | null>(
    null,
  );

  async function loadCatalog(refresh = false) {
    await Promise.resolve();
    setIsCatalogLoading(true);
    setCatalogError(null);

    try {
      const nextCatalog = refresh
        ? await adminRepository.refreshCatalog()
        : await adminRepository.getCatalog();
      setCatalog(nextCatalog);
      // console.log("Catalog loaded:", nextCatalog);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCatalogLoading(false);
    }
  }

  async function loadClients() {
    setIsClientsLoading(true);
    setClientsError(null);

    try {
      const clients = await adminRepository.listClients();
      setClients(clients);
    } catch (error) {
      setClientsError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsClientsLoading(false);
    }
  }

  async function loadContractStats() {
    setIsContractStatsLoading(true);
    setContractStatsError(null);

    try {
      setContractStats(await adminRepository.getContractStats());
    } catch (error) {
      setContractStatsError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsContractStatsLoading(false);
    }
  }

  async function loadBookingStats() {
    setIsBookingStatsLoading(true);
    setBookingStatsError(null);

    try {
      setBookingStats(await adminRepository.getBookingStats());
    } catch (error) {
      setBookingStatsError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsBookingStatsLoading(false);
    }
  }

  async function loadDashboardData(refresh = false) {
    await Promise.all([
      loadCatalog(refresh),
      loadClients(),
      loadContractStats(),
      loadBookingStats(),
    ]);
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadDashboardData();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, []);

  return (
    <>
      <Space wrap style={{ marginTop: 0 }}>
        <Button type="primary" onClick={() => setIsModalOpen(true)}>
          Відкрити модальне вікно
        </Button>
        <Button
          loading={
            isCatalogLoading ||
            isClientsLoading ||
            isContractStatsLoading ||
            isBookingStatsLoading
          }
          onClick={() => void loadDashboardData(true)}
        >
          Оновити дані з backend
        </Button>
      </Space>

      {catalogError && (
        <Alert
          message="Не вдалося отримати дані з backend"
          description={catalogError}
          type="error"
          showIcon
          style={{ marginTop: 24 }}
        />
      )}

      <div className="dashboard-stats">
        <StatCard
          title="Локації"
          value={catalog?.locations.length ?? 0}
          loading={isCatalogLoading}
          error={catalogError}
        />
        <StatCard
          title="Клієнти"
          value={clients.length}
          loading={isClientsLoading}
          error={clientsError}
        />
        <StatCard
          title="Контракти"
          value={contractStats?.contractsCount ?? 0}
          loading={isContractStatsLoading}
          error={contractStatsError}
        />
        <StatCard
          title="Пости"
          value={catalog?.servicePosts.length ?? 0}
          loading={isCatalogLoading}
          error={catalogError}
        />
        <StatCard
          title="Послуги"
          value={catalog?.services.length ?? 0}
          loading={isCatalogLoading}
          error={catalogError}
        />
        <StatCard
          title="Пропозиції"
          value={catalog?.offerings.length ?? 0}
          loading={isCatalogLoading}
          error={catalogError}
        />
        <StatCard
          title="Майбутні бронювання"
          value={booking_stats?.bookingsByStatus.upcomingBookingsCount ?? 0}
          loading={isBookingStatsLoading}
          error={bookingStatsError}
        />
      </div>

      <AppModal
        isOpen={isModalOpen}
        title="Приклад універсального вікна"
        okText="Зрозуміло"
        onCancel={() => setIsModalOpen(false)}
        onConfirm={() => setIsModalOpen(false)}
      >
        <p>
          Цей компонент можна використовувати для створення, редагування або
          підтвердження дій в адмін-панелі.
        </p>
      </AppModal>
    </>
  );
}

export default DashboardPage;
