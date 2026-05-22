import { Context } from "telegraf";

import { Step } from "./steps.js";

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
  applicableGroupId?: string;
  applicableVehicleTypeId?: string;
};

export type ServiceOfferingOption = {
  offeringId: string;
  optionId: string;
  isRequired: boolean;
  priceOverride?: number | null;
  extraDurationOverride?: number | null;
  sortOrder: number;
};

export type PricingSummary = {
  billingMode: "retail" | "contract";
  contractFound: boolean;
  contractMatched?: boolean;
  contractUnavailableReason?:
    | "vehicle_inactive"
    | "company_inactive"
    | "contract_not_active"
    | "contract_not_started"
    | "contract_expired"
    | "service_offering_not_found"
    | null;
  contract?: {
    id: number;
    number: string;
    companyTitle: string;
  } | null;
  vehicle?: {
    vehicleNumber: string;
    vehicleTypeId: string;
    vehicleGroupId: string;
    vehicleTypeTitle: string;
    title?: string;
  } | null;
  offeringId?: string | null;
  serviceId?: string | null;
  vehicleTypeId?: string | null;
  vehicleGroupId?: string | null;
  servicePrice?: number;
  serviceDurationMinutes?: number;
  optionItems?: {
    id: string;
    title: string;
    price: number;
    extraDurationMinutes: number;
  }[];
  totalPrice: number;
  totalDurationMinutes: number;
};

export type BookingDraft = {
  step: Step;
  bookingRequestId?: string;
  serviceId?: string;
  vehicleGroupId?: string;
  vehicleTypeId?: string;
  offeringId?: string;
  optionIds: string[];
  billingMode?: "retail" | "contract";
  pricing?: PricingSummary;
  vehicleNumber?: string;
  dateISO?: string;
  datePage?: number;
  timeHHMM?: string;
  timePage?: number;
  savedPhone?: string;
  phone?: string;
  fullName?: string;
};

export type SessionData = {
  booking?: BookingDraft;
};

export type BotContext = Context & {
  session: SessionData;
};
