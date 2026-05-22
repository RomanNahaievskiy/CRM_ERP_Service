import { request } from "./httpClient";
import type {
  BookingListItem,
  CancelBookingResult,
  Catalog,
  ClientListItem,
  MarkNoShowResult,
  ContractStats,
  BookingStats,
  OperationsSchedule,
  SendClientMessageResult,
} from "./types";

const CATALOG_CACHE_TTL_MS = 60_000;

let catalogCache: Catalog | undefined;
let catalogCacheLoadedAt = 0;

async function loadCatalog(): Promise<Catalog> {
  const cachedCatalog = catalogCache;
  const isCacheFresh =
    cachedCatalog !== undefined &&
    Date.now() - catalogCacheLoadedAt < CATALOG_CACHE_TTL_MS;

  if (isCacheFresh) {
    return cachedCatalog;
  }

  const freshCatalog = await request<Catalog>("/catalog/");
  catalogCache = freshCatalog;
  catalogCacheLoadedAt = Date.now();

  return freshCatalog;
}

type BookingsResponse = {
  bookings: BookingListItem[];
};

type ClientsResponse = {
  clients: ClientListItem[];
};

async function listBookings() {
  const result = await request<BookingsResponse>("/bookings/");
  return result.bookings;
}

async function listClients() {
  const result = await request<ClientsResponse>("/clients/");
  return result.clients;
}

async function cancelBooking(
  bookingId: number,
  reason?: string,
): Promise<CancelBookingResult> {
  return request<CancelBookingResult>(`/bookings/${bookingId}/cancel/`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

async function markNoShow(bookingId: number): Promise<MarkNoShowResult> {
  return request<MarkNoShowResult>(`/bookings/${bookingId}/no-show/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

async function sendClientMessage(
  clientId: number,
  text: string,
): Promise<SendClientMessageResult> {
  return request<SendClientMessageResult>(`/clients/${clientId}/messages/`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

async function getContractStats(): Promise<ContractStats> {
  return request<ContractStats>("/contracts/stats/");
}

async function getBookingStats(): Promise<BookingStats> {
  return request<BookingStats>("/bookings/stats/");
}

async function getOperationsSchedule(
  startDate: string,
  days: number,
): Promise<OperationsSchedule> {
  const params = new URLSearchParams({
    startDate,
    days: String(days),
  });

  return request<OperationsSchedule>(`/operations/schedule/?${params}`);
}

export const adminRepository = {
  getCatalog() {
    return loadCatalog();
  },

  refreshCatalog() {
    catalogCache = undefined;
    catalogCacheLoadedAt = 0;
    return loadCatalog();
  },

  listBookings,
  listClients,
  cancelBooking,
  markNoShow,
  sendClientMessage,
  getContractStats,
  getBookingStats,
  getOperationsSchedule,
};
