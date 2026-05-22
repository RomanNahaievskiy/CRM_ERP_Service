export type Location = {
  id: string;
  title: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
};

export type VehicleGroup = {
  id: string;
  title: string;
};

export type VehicleType = {
  id: string;
  groupId: string;
  title: string;
};

export type Service = {
  id: string;
  title: string;
};

export type ServiceOffering = {
  id: string;
  serviceId: string;
  vehicleTypeId: string;
  price: number;
  durationMinutes: number;
};

export type ServiceOption = {
  id: string;
  title: string;
  price: number;
  extraDurationMinutes: number;
  applicableGroupId?: string | null;
  applicableVehicleTypeId?: string | null;
};

export type ServiceOfferingOption = {
  offeringId: string;
  optionId: string;
  isRequired: boolean;
  priceOverride?: number | null;
  extraDurationOverride?: number | null;
  sortOrder: number;
};

export type ServicePost = {
  id: string;
  title: string;
  locationId?: string | null;
  supportedServiceIds: string[];
  supportedOptionIds: string[];
};

export type Catalog = {
  locations: Location[];
  vehicleGroups: VehicleGroup[];
  vehicleTypes: VehicleType[];
  services: Service[];
  offerings: ServiceOffering[];
  options: ServiceOption[];
  offeringOptions: ServiceOfferingOption[];
  servicePosts: ServicePost[];
};
export type BookingListOption = {
  id: string;
  title: string;
};

export type BookingListAllocation = {
  id: number;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  postId: string;
  postTitle: string;
  serviceTitle: string;
  optionTitle: string;
};

export type BookingListItem = {
  id: number;
  externalId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  clientType: string;
  vehicleNumber: string;
  clientName: string;
  clientPhone: string;
  serviceTitle: string;
  vehicleTypeTitle: string;
  postId: string;
  postTitle: string;
  options: BookingListOption[];
  totalPrice: number | null;
  comment: string;
  admin: string;
  allocations: BookingListAllocation[];
};

export type ClientListItem = {
  id: number;
  fullName: string;
  phone: string;
  username: string;
  telegramUserId: number | null;
  telegramChatId: number | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  bookingsCount: number;
};

export type SendClientMessageResult = {
  client: {
    id: number;
    fullName: string;
    telegramChatId: number;
  };
  message: {
    text: string;
    telegramMessageId: number | null;
  };
};

export type CancelBookingResult = {
  booking: {
    id: number;
    externalId: string;
    status: string;
    startsAt: string;
    endsAt: string;
  };
};

export type MarkNoShowResult = {
  booking: {
    id: number;
    externalId: string;
    status: string;
    startsAt: string;
    endsAt: string;
  };
};

export type ContractStats = {
  contractsCount: number;
  activeContractsCount: number;
};

export type BookingStats = {
  totalBookings: number;
  bookingsByStatus: {
    canceled: number;
    no_show: number;
    upcomingBookingsCount: number;
    pastBookingsCount: number;
  };
};

export type OperationsWorkingWindow = {
  startMinutes: number;
  endMinutes: number;
  startsAt: string;
  endsAt: string;
};

export type OperationsScheduleDay = {
  date: string;
  workingWindows: OperationsWorkingWindow[];
  posts?: OperationsSchedulePost[];
};

export type OperationsSchedulePost = {
  id: string;
  title: string;
  workingWindows: OperationsWorkingWindow[];
};

export type OperationsSchedule = {
  slotStepMinutes: number;
  days: OperationsScheduleDay[];
};
