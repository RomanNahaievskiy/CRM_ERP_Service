import {
  PricingSummary,
  Service,
  ServiceOffering,
  ServiceOfferingOption,
  ServiceOption,
  VehicleGroup,
  VehicleType,
} from "../types.js";

const vehicleGroups: VehicleGroup[] = [
  { id: "passenger", title: "Пасажирський транспорт" },
  { id: "cargo", title: "Вантажний транспорт" },
  { id: "tanker", title: "Автоцистерни" },
  { id: "other", title: "Інший транспорт" },
];

const vehicleTypes: VehicleType[] = [
  { id: "micro_18", groupId: "passenger", title: "Мікроавтобус до 18 місць" },
  { id: "bus_30", groupId: "passenger", title: "Автобус до 30 місць" },
  { id: "bus_double", groupId: "passenger", title: "Автобус 2-поверховий" },
  { id: "truck_10t", groupId: "cargo", title: "Вантажівка 10т" },
  { id: "tractor_semi", groupId: "cargo", title: "Тягач з напівпричепом" },
];

const services: Service[] = [
  { id: "wash", title: "Мийка" },
  { id: "suspension_diagnostics", title: "Діагностика підвіски" },
];

const offerings: ServiceOffering[] = [
  { id: "wash__micro_18", serviceId: "wash", vehicleTypeId: "micro_18", price: 800, durationMinutes: 15 },
  { id: "wash__bus_30", serviceId: "wash", vehicleTypeId: "bus_30", price: 900, durationMinutes: 15 },
  { id: "wash__bus_double", serviceId: "wash", vehicleTypeId: "bus_double", price: 1200, durationMinutes: 20 },
  { id: "wash__truck_10t", serviceId: "wash", vehicleTypeId: "truck_10t", price: 1200, durationMinutes: 20 },
  { id: "wash__tractor_semi", serviceId: "wash", vehicleTypeId: "tractor_semi", price: 1300, durationMinutes: 20 },
  { id: "suspension_diagnostics__bus_double", serviceId: "suspension_diagnostics", vehicleTypeId: "bus_double", price: 900, durationMinutes: 60 },
];

const options: ServiceOption[] = [
  { id: "undercarriage", title: "Мийка днища", price: 300, extraDurationMinutes: 0 },
  {
    id: "interior_small_18",
    title: "Прибирання салону",
    price: 100,
    extraDurationMinutes: 15,
    applicableVehicleTypeId: "micro_18",
  },
  {
    id: "interior_bus",
    title: "Прибирання салону",
    price: 250,
    extraDurationMinutes: 20,
    applicableGroupId: "passenger",
  },
  {
    id: "engine_wash",
    title: "Мийка двигуна",
    price: 300,
    extraDurationMinutes: 5,
    applicableGroupId: "passenger",
  },
];

const offeringOptions: ServiceOfferingOption[] = offerings
  .flatMap((offering) =>
    options.map((option, index) => ({
      offeringId: offering.id,
      optionId: option.id,
      isRequired: false,
      sortOrder: index,
    })),
  );

export const repository = {
  // TODO: Replace these stubs with Django API calls.
  async listServices() {
    return services;
  },

  async listVehicleGroupsForService(serviceId: string) {
    const typeIds = offerings
      .filter((offering) => offering.serviceId === serviceId)
      .map((offering) => offering.vehicleTypeId);
    const groupIds = new Set(
      vehicleTypes
        .filter((vehicleType) => typeIds.includes(vehicleType.id))
        .map((vehicleType) => vehicleType.groupId),
    );

    return vehicleGroups.filter((group) => groupIds.has(group.id));
  },

  async listOfferingsForServiceAndGroup(serviceId: string, groupId: string) {
    return offerings.filter((offering) => {
      const vehicleType = vehicleTypes.find((item) => item.id === offering.vehicleTypeId);
      return offering.serviceId === serviceId && vehicleType?.groupId === groupId;
    });
  },

  async listOptionsForOffering(offeringId: string) {
    const offering = offerings.find((item) => item.id === offeringId);
    const vehicleType = vehicleTypes.find((item) => item.id === offering?.vehicleTypeId);
    if (!offering || !vehicleType) {
      return [];
    }

    const links = offeringOptions
      .filter((link) => link.offeringId === offeringId)
      .sort((left, right) => left.sortOrder - right.sortOrder);

    return links.flatMap((link) => {
      const option = options.find((item) => item.id === link.optionId);
      if (!option) {
        return [];
      }
      const groupOk = !option.applicableGroupId || option.applicableGroupId === vehicleType.groupId;
      const vehicleOk =
        !option.applicableVehicleTypeId || option.applicableVehicleTypeId === vehicleType.id;
      if (!groupOk || !vehicleOk) {
        return [];
      }
      return [
        {
          ...option,
          price: link.priceOverride ?? option.price,
          extraDurationMinutes: link.extraDurationOverride ?? option.extraDurationMinutes,
        },
      ];
    });
  },

  async getCatalog() {
    return { vehicleGroups, vehicleTypes, services, offerings, options, offeringOptions };
  },

  async resolvePricing(input: {
    serviceId?: string;
    serviceOfferingId?: string;
    vehicleTypeId?: string;
    vehicleNumber?: string;
    billingMode?: "retail" | "contract" | "auto";
    optionIds: string[];
  }): Promise<PricingSummary> {
    const offering =
      offerings.find((item) => item.id === input.serviceOfferingId) ??
      offerings.find(
        (item) => item.serviceId === input.serviceId && item.vehicleTypeId === input.vehicleTypeId,
      );
    const offeringId = offering?.id ?? "";
    const selectedOptions = options.filter((option) => {
      if (!input.optionIds.includes(option.id)) {
        return false;
      }
      return offeringOptions.some(
        (link) => link.offeringId === offeringId && link.optionId === option.id,
      );
    });
    const totalPrice =
      (offering?.price ?? 0) + selectedOptions.reduce((sum, option) => sum + option.price, 0);
    const totalDurationMinutes =
      (offering?.durationMinutes ?? 0) +
      selectedOptions.reduce((sum, option) => sum + option.extraDurationMinutes, 0);

    return {
      billingMode: input.billingMode === "contract" ? "contract" : "retail",
      contractFound: false,
      contract: null,
      vehicle: null,
      offeringId: offering?.id,
      serviceId: input.serviceId ?? offering?.serviceId,
      vehicleTypeId: offering?.vehicleTypeId,
      vehicleGroupId: vehicleTypes.find((item) => item.id === offering?.vehicleTypeId)?.groupId,
      servicePrice: offering?.price ?? 0,
      serviceDurationMinutes: offering?.durationMinutes ?? 0,
      optionItems: selectedOptions,
      totalPrice,
      totalDurationMinutes,
    };
  },

  async createBooking(input: unknown) {
    console.log("TODO create booking through Django API:", JSON.stringify(input, null, 2));
    return { id: `stub-${Date.now()}` };
  },
};
