import { config } from "../config.js";
import {
  PricingSummary,
  Service,
  ServiceOffering,
  ServiceOfferingOption,
  ServiceOption,
  VehicleGroup,
  VehicleType,
} from "../types.js";

type Catalog = {
  vehicleGroups: VehicleGroup[];
  vehicleTypes: VehicleType[];
  services: Service[];
  offerings: ServiceOffering[];
  options: ServiceOption[];
  offeringOptions?: ServiceOfferingOption[];
  servicePosts?: {
    id: string;
    title: string;
    supportedServiceIds: string[];
    supportedOptionIds: string[];
  }[];
};

type CreateBookingInput = {
  idempotencyKey?: string;
  telegramUserId?: number;
  telegramChatId?: number;
  username?: string;
  fullName?: string;
  phone: string;
  serviceOfferingId: string;
  optionIds: string[];
  billingMode?: "retail" | "contract";
  vehicleNumber?: string;
  startsAt: string;
  endsAt: string;
  totalPrice: number;
  totalDurationMinutes: number;
};

type CreateBookingResult = {
  id: string;
  bookingId?: number;
  startsAt?: string;
  location?: {
    id: string;
    title: string;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  operator?: {
    title: string;
    phone: string;
    telegramUsername?: string;
  } | null;
};

type AvailabilityResult = {
  date: string;
  slots: string[];
};

type ClientContactResult = {
  found: boolean;
  phone: string;
  fullName?: string;
  username?: string;
};

type ResolvePricingInput = {
  serviceId?: string;
  serviceOfferingId?: string;
  vehicleTypeId?: string;
  vehicleNumber?: string;
  billingMode?: "retail" | "contract" | "auto";
  optionIds: string[];
};

export type ReminderDelivery = {
  id: number;
  offsetMinutes: number;
  scheduledAt: string;
  booking: {
    id: number;
    externalId: string;
    startsAt: string;
    endsAt: string;
    vehicleNumber: string;
    serviceTitle: string;
    vehicleTypeTitle: string;
    servicePostTitle: string;
    location?: {
      title: string;
      address?: string;
      latitude?: number | null;
      longitude?: number | null;
    } | null;
    operator?: {
      title: string;
      phone: string;
      telegramUsername?: string;
    } | null;
  };
  client: {
    telegramChatId: number;
    fullName?: string;
  };
};

const CATALOG_CACHE_TTL_MS = 60_000;

let catalogCache: Catalog | undefined;
let catalogCacheLoadedAt = 0;

// Універсальна функція - обгортка по типу fetch, яка робить запити до API і обробляє помилки

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${config.apiBaseUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status} ${response.statusText}: ${body}`);
  }

  return response.json() as Promise<T>;
}

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
// головна точка доступу до API - об'єкт repository з методами для отримання даних та виконання дій, які використовують функцію request та кешування каталогу там, де це потрібно

export const repository = {
  async listServices() {
    return (await loadCatalog()).services;
  },

  async listVehicleGroupsForService(serviceId: string) {
    const catalog = await loadCatalog();
    const typeIds = catalog.offerings
      .filter((offering) => offering.serviceId === serviceId)
      .map((offering) => offering.vehicleTypeId);
    const groupIds = new Set(
      catalog.vehicleTypes
        .filter((vehicleType) => typeIds.includes(vehicleType.id))
        .map((vehicleType) => vehicleType.groupId),
    );

    return catalog.vehicleGroups.filter((group) => groupIds.has(group.id));
  },

  async listOfferingsForServiceAndGroup(serviceId: string, groupId: string) {
    const catalog = await loadCatalog();

    return catalog.offerings.filter((offering) => {
      const vehicleType = catalog.vehicleTypes.find(
        (item) => item.id === offering.vehicleTypeId,
      );
      return (
        offering.serviceId === serviceId && vehicleType?.groupId === groupId
      );
    });
  },

  async listOptionsForOffering(offeringId: string) {
    const catalog = await loadCatalog();
    const offering = catalog.offerings.find((item) => item.id === offeringId);
    const vehicleType = catalog.vehicleTypes.find(
      (item) => item.id === offering?.vehicleTypeId,
    );
    if (!offering || !vehicleType) {
      return [];
    }

    const links = (catalog.offeringOptions ?? [])
      .filter((link) => link.offeringId === offeringId)
      .sort((left, right) => left.sortOrder - right.sortOrder);

    return links.flatMap((link) => {
      const option = catalog.options.find((item) => item.id === link.optionId);
      if (!option) {
        return [];
      }
      const groupOk =
        !option.applicableGroupId ||
        option.applicableGroupId === vehicleType.groupId;
      const vehicleOk =
        !option.applicableVehicleTypeId ||
        option.applicableVehicleTypeId === vehicleType.id;
      if (!groupOk || !vehicleOk) {
        return [];
      }

      return [
        {
          ...option,
          price: link.priceOverride ?? option.price,
          extraDurationMinutes:
            link.extraDurationOverride ?? option.extraDurationMinutes,
        },
      ];
    });
  },

  async getCatalog() {
    return loadCatalog();
  },

  async getClientContactByTelegram(
    telegramUserId: number,
  ): Promise<ClientContactResult> {
    return request<ClientContactResult>(`/clients/telegram/${telegramUserId}/`);
  },

  async resolvePricing(input: ResolvePricingInput): Promise<PricingSummary> {
    return request<PricingSummary>("/pricing/resolve/", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async listAvailableTimeSlots(
    dateISO: string,
    serviceOfferingId: string,
    optionIds: string[],
    vehicleNumber?: string,
    billingMode?: "retail" | "contract",
  ) {
    const params = new URLSearchParams({
      date: dateISO,
      serviceOfferingId,
    });
    if (vehicleNumber) {
      params.set("vehicleNumber", vehicleNumber);
    }
    if (billingMode) {
      params.set("billingMode", billingMode);
    }
    for (const optionId of optionIds) {
      params.append("optionIds", optionId);
    }
    const result = await request<AvailabilityResult>(
      `/availability/?${params.toString()}`,
    );
    return result.slots;
  },

  async createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
    const result = await request<CreateBookingResult>("/bookings/", {
      method: "POST",
      body: JSON.stringify(input),
    });
    catalogCache = undefined;
    catalogCacheLoadedAt = 0;
    return result;
  },

  async claimDueReminders(limit = 20): Promise<ReminderDelivery[]> {
    const result = await request<{ reminders: ReminderDelivery[] }>(
      "/reminders/claim/",
      {
        method: "POST",
        body: JSON.stringify({ limit }),
      },
    );
    return result.reminders;
  },

  async markReminderSent(reminderId: number): Promise<void> {
    await request<{ ok: boolean }>(`/reminders/${reminderId}/sent/`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  async markReminderFailed(reminderId: number, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await request<{ ok: boolean }>(`/reminders/${reminderId}/failed/`, {
      method: "POST",
      body: JSON.stringify({ error: message }),
    });
  },
};
