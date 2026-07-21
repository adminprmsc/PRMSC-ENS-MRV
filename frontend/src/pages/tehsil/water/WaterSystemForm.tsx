import { useState, useMemo, useEffect, type ChangeEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { tehsilRoutes } from "../../../constants/routes";
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Droplets,
  Loader2,
  Send,
  ArrowLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import Toast from "../../../components/Toast";
import { PageHeader, PageShell } from "../../../components/layout";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { FormStepper } from "../../../components/ui/form-stepper";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field";
import { Input } from "../../../components/ui/input";
import { Separator } from "../../../components/ui/separator";
import { Badge } from "../../../components/ui/badge";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { getApiErrorMessage } from "../../../lib/api-error";
import {
  TEHSIL_OPTIONS,
  LOCATION_DATA,
  SETTLEMENT_DATA,
} from "../../../utils/locationData";
import { cn } from "../../../lib/utils";

/** Map API / profile tehsil string to canonical `TEHSIL_OPTIONS` entry. */
function canonicalTehsil(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  return (TEHSIL_OPTIONS as readonly string[]).find((o) => o === t) ?? null;
}

function FormField({
  label,
  required,
  description,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Field className={className}>
      <FieldLabel>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}

const inputClass = "h-10 bg-background";

type ToastType = "success" | "error";
type SubmissionStatus = "submitted";
const WaterSystemForm = () => {
  const isEditMode = false;
  const { user } = useAuth();
  const { createWaterSystem, getWaterSystemConfig } =
    useTehsilManagerOperatorApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType }>({
    message: "",
    type: "success",
  });
  const [activeStep, setActiveStep] = useState(1); // 1: Location, 2: Equipment, 3: Metering

  const tehsilSelectOptions = useMemo(() => {
    const fromUser = (user?.tehsils ?? [])
      .map(canonicalTehsil)
      .filter((x): x is string => Boolean(x));
    const unique = [...new Set(fromUser)];
    if (unique.length > 0) return unique;
    return [...TEHSIL_OPTIONS];
  }, [user?.tehsils]);

  const tehsilSelectLocked = tehsilSelectOptions.length === 1;

  const [formData, setFormData] = useState({
    tehsil: "",
    village: "",
    settlement: "",
    latitude: "",
    longitude: "",
    pump_model: "",
    pump_serial_number: "",
    start_of_operation: "",
    depth_of_water_intake: "",
    height_to_ohr: "",
    pump_flow_rate: "",
    bulk_meter_installed: true,
    ohr_tank_capacity: "",
    ohr_fill_required: "",
    pump_capacity: "",
    pump_head: "",
    pump_horse_power: "",
    time_to_fill: "",
    meter_model: "",
    meter_serial_number: "",
    meter_accuracy_class: "",
    installation_date: "",
  });
  const [villageSearch, setVillageSearch] = useState("");
  const [settlementSearch, setSettlementSearch] = useState("");
  const [locationHasOtherSystems, setLocationHasOtherSystems] = useState(false);

  useEffect(() => {
    if (isEditMode || tehsilSelectOptions.length !== 1) return;
    const only = tehsilSelectOptions[0];
    if (!only) return;
    setFormData((prev) =>
      prev.tehsil === only
        ? prev
        : { ...prev, tehsil: only, village: "", settlement: "" },
    );
  }, [isEditMode, tehsilSelectOptions]);

  useEffect(() => {
    setVillageSearch("");
    setSettlementSearch("");
  }, [formData.tehsil]);

  useEffect(() => {
    setSettlementSearch("");
  }, [formData.village]);

  const filteredVillages = useMemo(() => {
    const villages = LOCATION_DATA[formData.tehsil] || [];
    const query = villageSearch.trim().toLowerCase();
    if (!query) return villages;
    return villages.filter((v) => v.toLowerCase().includes(query));
  }, [formData.tehsil, villageSearch]);

  const filteredSettlements = useMemo(() => {
    const settlements = SETTLEMENT_DATA[formData.village] || [];
    const query = settlementSearch.trim().toLowerCase();
    if (!query) return settlements;
    return settlements.filter((s) => s.toLowerCase().includes(query));
  }, [formData.village, settlementSearch]);

  const handleFieldChange = async (name: string, value: string) => {
    let newTehsil = formData.tehsil;
    let newVillage = formData.village;
    let newSettlement = formData.settlement;

    if (name === "tehsil") {
      newTehsil = value;
      newVillage = "";
      newSettlement = "";
    } else if (name === "village") {
      newVillage = value;
      newSettlement = "";
    } else if (name === "settlement") {
      newSettlement = value;
    }

    setFormData({
      ...formData,
      [name]: value,
      ...(name === "tehsil" && { village: "", settlement: "" }),
      ...(name === "village" && { settlement: "" }),
    });

    if (
      (name === "tehsil" || name === "village" || name === "settlement") &&
      newTehsil &&
      newVillage
    ) {
      try {
        const result = await getWaterSystemConfig(
          newTehsil,
          newVillage,
          newSettlement || "",
        );
        // Multiple water systems are allowed at the same location.
        setLocationHasOtherSystems(
          !isEditMode && Boolean(result.exists && result.config),
        );
      } catch (error: unknown) {
        setLocationHasOtherSystems(false);
        setToast({
          message: getApiErrorMessage(error, "Failed to validate location"),
          type: "error",
        });
      }
    }
  };

  const handleChange = async (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    await handleFieldChange(name, value);
  };

  const handleSubmit = async (status: SubmissionStatus = "submitted") => {
    setLoading(true);
    try {
      const {
        meter_model,
        meter_serial_number,
        meter_accuracy_class,
        installation_date,
        ...rest
      } = formData;
      await createWaterSystem({
        ...rest,
        status,
        current_meter: {
          meter_type: "tubewell",
          meter_model,
          meter_serial_number,
          meter_accuracy_class,
          installation_date,
        },
      });
      setToast({
        message: "✅ Registration complete!",
        type: "success",
      });
      if (status === "submitted") {
        setTimeout(() => navigate(tehsilRoutes.dashboard), 1200);
      }
    } catch (err: unknown) {
      setToast({
        message: getApiErrorMessage(err, "Submission failed"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      id: 1,
      label: "Location",
      hint: "Choose tehsil, village, and settlement",
    },
    { id: 2, label: "Equipment", hint: "Enter pump and operation details" },
    {
      id: 3,
      label: "Metering",
      hint: "Set metering and calibration information",
    },
  ];

  const REQUIRED_FIELDS_BY_STEP: Record<
    number,
    Array<keyof typeof formData>
  > = {
    1: ["tehsil", "village"],
    2: ["pump_model", "pump_flow_rate", "pump_horse_power", "start_of_operation"],
    3: ["bulk_meter_installed"],
  };

  const FIELD_LABELS: Record<string, string> = {
    tehsil: "Tehsil",
    village: "Village",
    settlement: "Settlement",
    latitude: "Latitude",
    longitude: "Longitude",
    pump_model: "Pump Model",
    pump_serial_number: "Pump Serial Number",
    start_of_operation: "Operation Start",
    depth_of_water_intake: "Column Height",
    height_to_ohr: "Height to OHR",
    pump_flow_rate: "Flow Rate",
    bulk_meter_installed: "Bulk meter installed",
    ohr_tank_capacity: "Tank capacity (m3)",
    ohr_fill_required: "Design time to fill tank (minutes)",
    pump_capacity: "Pump capacity (kW)",
    pump_head: "Pump head (m)",
    pump_horse_power: "Pump horse power (HP)",
    time_to_fill: "Actual time to fill the tank",
    meter_model: "Meter Model",
    meter_serial_number: "Meter Serial Number",
    meter_accuracy_class: "Accuracy Class",
    installation_date: "Installation Date",
  };

  const validateStep = (stepToValidate: number) => {
    const requiredFields = REQUIRED_FIELDS_BY_STEP[stepToValidate] ?? [];
    const conditionalRequired =
      stepToValidate === 3
        ? formData.bulk_meter_installed
          ? ([
              "meter_model",
              "meter_serial_number",
              "meter_accuracy_class",
              "installation_date",
            ] as Array<keyof typeof formData>)
          : ([
              "ohr_tank_capacity",
              "ohr_fill_required",
              "pump_capacity",
              "pump_head",
              "time_to_fill",
            ] as Array<keyof typeof formData>)
        : [];
    const allRequired = [...requiredFields, ...conditionalRequired];
    const missing = allRequired.filter((field) => {
      const v = formData[field];
      if (typeof v === "boolean") return false;
      return !String(v).trim();
    });

    if (missing.length === 0) return true;

    setToast({
      message: `Complete required fields: ${missing
        .map((field) => FIELD_LABELS[field])
        .join(", ")}`,
      type: "error",
    });
    return false;
  };

  const attemptStepChange = (targetStep: number) => {
    if (targetStep <= activeStep) {
      setActiveStep(targetStep);
      return;
    }

    for (
      let stepNumber = activeStep;
      stepNumber < targetStep;
      stepNumber += 1
    ) {
      if (!validateStep(stepNumber)) return;
    }

    setActiveStep(targetStep);
  };

  const stepMeta = steps.find((s) => s.id === activeStep) ?? steps[0];

  return (
    <PageShell>
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "success" })}
      />

      <PageHeader
        icon={<Droplets />}
        title={isEditMode ? "Edit water system" : "Register water system"}
        description={
          isEditMode
            ? "Update equipment and metering for this location."
            : "Register a new water system for monitoring and reporting."
        }
        badge={
          <Badge variant="secondary" className="font-normal">
            {isEditMode ? "Edit mode" : "New registration"}
          </Badge>
        }
        actions={
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" />
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <FormStepper
            steps={steps}
            currentStep={activeStep}
            onStepClick={attemptStepChange}
          />
        </CardContent>
      </Card>

      {locationHasOtherSystems ? (
        <Alert>
          <AlertTitle>Other systems already at this location</AlertTitle>
          <AlertDescription>
            You can register another water system for the same tehsil, village,
            and settlement. Each system gets its own unique ID.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base">{stepMeta?.label}</CardTitle>
          <CardDescription>{stepMeta?.hint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
              {activeStep === 1 ? (
                <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  {tehsilSelectLocked ? (
                    <FormField
                      label="Tehsil"
                      required
                      description="Auto-selected for your scope."
                    >
                      <Input
                        readOnly
                        value={formData.tehsil}
                        className={cn(inputClass, "bg-muted/40 font-medium")}
                      />
                    </FormField>
                  ) : (
                    <FormField
                      label="Tehsil"
                      required
                      description="Scoped to your assigned tehsils."
                    >
                      <Select
                        value={formData.tehsil || undefined}
                        disabled={isEditMode}
                        onValueChange={(v) => {
                          if (v) void handleFieldChange("tehsil", v);
                        }}
                      >
                        <SelectTrigger className={cn("w-full", inputClass)}>
                          <SelectValue placeholder="Select tehsil" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {tehsilSelectOptions.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  )}

                  <FormField
                    label="Village"
                    required
                    description="Filtered by selected tehsil."
                  >
                    <Select
                      value={formData.village || undefined}
                      onValueChange={(v) => {
                        if (v) void handleFieldChange("village", v);
                      }}
                    >
                      <SelectTrigger
                        className={cn("w-full", inputClass)}
                        disabled={!formData.tehsil || isEditMode}
                      >
                        <SelectValue placeholder="Select village" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <div className="sticky top-0 z-10 border-b bg-popover p-2">
                          <Input
                            value={villageSearch}
                            onChange={(e) => setVillageSearch(e.target.value)}
                            onKeyDownCapture={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (
                                e.key === "ArrowDown" ||
                                e.key === "ArrowUp" ||
                                e.key === "Enter" ||
                                e.key === "Tab"
                              ) {
                                e.preventDefault();
                              }
                            }}
                            onKeyUp={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            placeholder="Search village…"
                            className="h-9"
                          />
                        </div>
                        {filteredVillages.map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                        {filteredVillages.length === 0 ? (
                          <p className="px-2 py-2 text-xs text-muted-foreground">
                            No villages match.
                          </p>
                        ) : null}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField
                    label="Settlement"
                    description="Optional — leave blank if not mapped."
                  >
                    <Select
                      value={formData.settlement || undefined}
                      onValueChange={(v) => {
                        void handleFieldChange("settlement", v ?? "");
                      }}
                    >
                      <SelectTrigger
                        className={cn("w-full", inputClass)}
                        disabled={!formData.village || isEditMode}
                      >
                        <SelectValue placeholder="Select settlement" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <div className="sticky top-0 z-10 border-b bg-popover p-2">
                          <Input
                            value={settlementSearch}
                            onChange={(e) =>
                              setSettlementSearch(e.target.value)
                            }
                            onKeyDownCapture={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (
                                e.key === "ArrowDown" ||
                                e.key === "ArrowUp" ||
                                e.key === "Enter" ||
                                e.key === "Tab"
                              ) {
                                e.preventDefault();
                              }
                            }}
                            onKeyUp={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            placeholder="Search settlement…"
                            className="h-9"
                          />
                        </div>
                        <SelectItem value="">None</SelectItem>
                        {filteredSettlements.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                        {filteredSettlements.length === 0 ? (
                          <p className="px-2 py-2 text-xs text-muted-foreground">
                            No settlements match.
                          </p>
                        ) : null}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <div className="col-span-full grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <FormField
                      label="Latitude"
                      description="GPS coordinate for mapping."
                    >
                      <Input
                        type="number"
                        name="latitude"
                        value={formData.latitude}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="e.g. 29.99812"
                        disabled={loading}
                        inputMode="decimal"
                      />
                    </FormField>

                    <FormField
                      label="Longitude"
                      description="GPS coordinate for mapping."
                    >
                      <Input
                        type="number"
                        name="longitude"
                        value={formData.longitude}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="e.g. 73.25291"
                        disabled={loading}
                        inputMode="decimal"
                      />
                    </FormField>
                  </div>
                </FieldGroup>
              ) : null}

              {activeStep === 2 ? (
                <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField label="Pump model" required>
                    <Input
                      name="pump_model"
                      value={formData.pump_model}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="e.g. Grundfos CRI"
                      disabled={loading}
                    />
                  </FormField>
                  <FormField label="Pump serial number">
                    <Input
                      name="pump_serial_number"
                      value={formData.pump_serial_number}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="SN-XXXX"
                      disabled={loading}
                    />
                  </FormField>
                  <FormField
                    label="Column height (m)"
                    description="Vertical distance of the water column."
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        name="depth_of_water_intake"
                        value={formData.depth_of_water_intake}
                        onChange={handleChange}
                        className={cn(inputClass, "flex-1")}
                        placeholder="0.0"
                        disabled={loading}
                      />
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-10 shrink-0 text-muted-foreground"
                              aria-label="Column height help"
                            >
                              <Info className="size-4" />
                            </Button>
                          }
                        />
                        <TooltipContent>
                          Formerly intake depth — height of the water column.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </FormField>
                  <FormField label="Flow rate (m³/h)" required>
                    <Input
                      type="number"
                      name="pump_flow_rate"
                      value={formData.pump_flow_rate}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="0.0"
                      disabled={loading}
                    />
                  </FormField>
                  <FormField label="Pump horse power (HP)" required>
                    <Input
                      type="number"
                      inputMode="decimal"
                      name="pump_horse_power"
                      value={formData.pump_horse_power}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="e.g. 7.5"
                      disabled={loading}
                    />
                  </FormField>
                  <FormField label="Operation start" required>
                    <Input
                      type="date"
                      name="start_of_operation"
                      value={formData.start_of_operation}
                      onChange={handleChange}
                      className={inputClass}
                      disabled={loading}
                    />
                  </FormField>
                </FieldGroup>
              ) : null}

              {activeStep === 3 ? (
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        Bulk meter installed
                        <span className="text-destructive">*</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Yes if a bulk meter is on site; No for OHR-only systems.
                      </p>
                    </div>
                    <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          formData.bulk_meter_installed ? "default" : "ghost"
                        }
                        className="min-w-[4rem] rounded-md"
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            bulk_meter_installed: true,
                          }))
                        }
                        disabled={loading}
                      >
                        Yes
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          !formData.bulk_meter_installed ? "default" : "ghost"
                        }
                        className="min-w-[4rem] rounded-md"
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            bulk_meter_installed: false,
                          }))
                        }
                        disabled={loading}
                      >
                        No
                      </Button>
                    </div>
                  </div>

                  {!formData.bulk_meter_installed ? (
                    <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      <FormField label="Tank capacity (m³)" required>
                        <Input
                          type="number"
                          inputMode="decimal"
                          name="ohr_tank_capacity"
                          value={formData.ohr_tank_capacity}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="e.g. 10"
                          disabled={loading}
                        />
                      </FormField>
                      <FormField label="Design fill time (min)" required>
                        <Input
                          type="number"
                          inputMode="decimal"
                          name="ohr_fill_required"
                          value={formData.ohr_fill_required}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="e.g. 10"
                          disabled={loading}
                        />
                      </FormField>
                      <FormField label="Pump capacity (kW)" required>
                        <Input
                          type="number"
                          inputMode="decimal"
                          name="pump_capacity"
                          value={formData.pump_capacity}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="e.g. 5"
                          disabled={loading}
                        />
                      </FormField>
                      <FormField label="Pump head (m)" required>
                        <Input
                          type="number"
                          inputMode="decimal"
                          name="pump_head"
                          value={formData.pump_head}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="e.g. 40"
                          disabled={loading}
                        />
                      </FormField>
                      <FormField label="Actual fill time (min)" required>
                        <Input
                          type="number"
                          inputMode="decimal"
                          name="time_to_fill"
                          value={formData.time_to_fill}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="e.g. 60"
                          disabled={loading}
                        />
                      </FormField>
                    </FieldGroup>
                  ) : (
                    <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                      <FormField label="Installation date" required>
                        <Input
                          type="date"
                          name="installation_date"
                          value={formData.installation_date}
                          onChange={handleChange}
                          className={inputClass}
                          disabled={loading}
                        />
                      </FormField>
                      <FormField label="Meter model" required>
                        <Input
                          name="meter_model"
                          value={formData.meter_model}
                          onChange={handleChange}
                          className={inputClass}
                          disabled={loading}
                        />
                      </FormField>
                      <FormField label="Meter serial number" required>
                        <Input
                          name="meter_serial_number"
                          value={formData.meter_serial_number}
                          onChange={handleChange}
                          className={inputClass}
                          disabled={loading}
                        />
                      </FormField>
                      <FormField label="Accuracy class" required>
                        <Input
                          name="meter_accuracy_class"
                          value={formData.meter_accuracy_class}
                          onChange={handleChange}
                          placeholder="e.g. Class B"
                          className={inputClass}
                          disabled={loading}
                        />
                      </FormField>
                    </FieldGroup>
                  )}
                </div>
              ) : null}

              <Separator />

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                {activeStep > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveStep((prev) => prev - 1)}
                  >
                    Back
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  {activeStep < 3 ? (
                    <Button
                      type="button"
                      onClick={() => attemptStepChange(activeStep + 1)}
                      className="gap-2"
                      disabled={loading}
                    >
                      Continue
                      <ChevronRight className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => void handleSubmit("submitted")}
                      disabled={
                        loading ||
                        !formData.tehsil ||
                        !formData.village
                      }
                      className="gap-2"
                    >
                      {loading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      Complete registration
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
    </PageShell>
  );
};

export default WaterSystemForm;
