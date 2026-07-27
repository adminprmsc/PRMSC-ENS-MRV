import api from "@/api/api";

export type LocationCatalog = {
  tehsils: string[];
  villages_by_tehsil: Record<string, string[]>;
  settlements_by_tehsil_village: Record<string, Record<string, string[]>>;
  meta: {
    village_count: number;
    settlement_count: number;
    custom_village_count: number;
    custom_settlement_count: number;
  };
};

export type LocationVillageRow = {
  id: string;
  tehsil: string;
  name: string;
  is_custom: boolean;
  is_active: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LocationSettlementRow = {
  id: string;
  tehsil: string;
  village: string;
  name: string;
  is_custom: boolean;
  is_active: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function getLocationCatalog(tehsil?: string) {
  const response = await api.get("/locations/catalog", {
    params: tehsil ? { tehsil } : undefined,
  });
  return response.data as LocationCatalog;
}

export async function listLocationVillages(params?: {
  tehsil?: string;
  custom_only?: boolean;
}) {
  const response = await api.get("/locations/villages", {
    params: {
      ...(params?.tehsil ? { tehsil: params.tehsil } : {}),
      ...(params?.custom_only ? { custom_only: "1" } : {}),
    },
  });
  return response.data as { villages: LocationVillageRow[] };
}

export async function listLocationSettlements(params?: {
  tehsil?: string;
  village?: string;
  custom_only?: boolean;
}) {
  const response = await api.get("/locations/settlements", {
    params: {
      ...(params?.tehsil ? { tehsil: params.tehsil } : {}),
      ...(params?.village ? { village: params.village } : {}),
      ...(params?.custom_only ? { custom_only: "1" } : {}),
    },
  });
  return response.data as { settlements: LocationSettlementRow[] };
}

export async function addLocationVillage(body: {
  tehsil: string;
  name: string;
}) {
  const response = await api.post("/locations/villages", body);
  return response.data as { message: string; village: LocationVillageRow };
}

export async function addLocationSettlement(body: {
  tehsil: string;
  village: string;
  name: string;
}) {
  const response = await api.post("/locations/settlements", body);
  return response.data as {
    message: string;
    settlement: LocationSettlementRow;
  };
}

export async function deactivateLocationVillage(id: string) {
  const response = await api.delete(`/locations/villages/${encodeURIComponent(id)}`);
  return response.data as { message: string };
}

export async function deactivateLocationSettlement(id: string) {
  const response = await api.delete(
    `/locations/settlements/${encodeURIComponent(id)}`,
  );
  return response.data as { message: string };
}
