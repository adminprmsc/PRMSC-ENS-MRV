import {
  useState,
  useMemo,
  useEffect,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { tehsilRoutes } from "../../../constants/routes";
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { useAuth } from "../../../contexts/AuthContext";
import { Sun, Loader2, Send, ArrowLeft, ChevronRight } from "lucide-react";
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
import { Badge } from "../../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
import { Separator } from "../../../components/ui/separator";
import { getApiErrorMessage } from "../../../lib/api-error";
import { SearchableOptionField } from "../../../components/common/SearchableOptionField";
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

const INSTALLATION_TYPE_OPTIONS = [
  "Ground mounted",
  "Rooftop",
  "Other",
] as const;

const DISCO_OPTIONS = [
  "LESCO",
  "PESCO",
  "GEPCO",
  "FESCO",
  "IESCO",
  "MEPCO",
  "HESCO",
  "SEPCO",
  "QESCO",
  "TESCO",
] as const;

const SolarSystemForm = () => {
  const isEditMode = false;
  const { user } = useAuth();
  const { createSolarSystem, getSolarSystemConfig } =
    useTehsilManagerOperatorApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType }>({
    message: "",
    type: "success",
  });
  const [activeStep, setActiveStep] = useState(1);

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
    installation_location: "",
    installation_location_other: "",
    disco_info: "",
    bill_reference_number: "",
    solar_panel_capacity: "",
    inverter_capacity: "",
    inverter_serial_number: "",
    solar_connection_date: "",
    electricity_connection_date: "",
    green_connection_date: "",
    meter_model: "",
    meter_serial_number: "",
    remarks: "",
  });
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

  const villageOptions = useMemo(
    () => LOCATION_DATA[formData.tehsil] || [],
    [formData.tehsil],
  );

  const settlementOptions = useMemo(
    () => SETTLEMENT_DATA[formData.village] || [],
    [formData.village],
  );

  const installationTypeValue = (
    INSTALLATION_TYPE_OPTIONS as readonly string[]
  ).includes(formData.installation_location)
    ? formData.installation_location
    : formData.installation_location
      ? "Other"
      : undefined;

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
      !isEditMode &&
      (name === "tehsil" || name === "village" || name === "settlement") &&
      newTehsil &&
      newVillage
    ) {
      try {
        const result = await getSolarSystemConfig(
          newTehsil,
          newVillage,
          newSettlement || "",
        );
        // Multiple solar sites are allowed at the same location.
        setLocationHasOtherSystems(Boolean(result.exists && result.config));
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

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const installation_location =
        formData.installation_location === "Other"
          ? formData.installation_location_other.trim()
          : formData.installation_location.trim();
      const {
        meter_model,
        meter_serial_number,
        green_connection_date,
        ...rest
      } = formData;
      await createSolarSystem({
        ...rest,
        meter_model: undefined,
        meter_serial_number: undefined,
        installation_location_other: undefined,
        installation_location,
        current_meter: {
          meter_type: "solar",
          meter_model,
          meter_serial_number,
          installation_date: green_connection_date,
        },
      });
      setToast({ message: "Solar site registered.", type: "success" });
      setTimeout(() => navigate(tehsilRoutes.solarSites), 1200);
    } catch (err: unknown) {
      setToast({
        message: getApiErrorMessage(err, "Save failed"),
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
      hint: "Choose tehsil, village, and installation site",
    },
    {
      id: 2,
      label: "PV assets",
      hint: "Capacity and solar connection details",
    },
    {
      id: 3,
      label: "Metering",
      hint: "Meter details and grid connection dates",
    },
  ];

  const REQUIRED_FIELDS_BY_STEP: Record<
    number,
    Array<keyof typeof formData>
  > = {
    1: ["tehsil", "village", "installation_location"],
    2: [
      "disco_info",
      "bill_reference_number",
      "solar_panel_capacity",
      "inverter_capacity",
      "inverter_serial_number",
      "solar_connection_date",
    ],
    3: [
      "meter_model",
      "meter_serial_number",
      "electricity_connection_date",
      "green_connection_date",
    ],
  };

  const FIELD_LABELS: Record<keyof typeof formData, string> = {
    tehsil: "Tehsil",
    village: "Village",
    settlement: "Settlement",
    latitude: "Latitude",
    longitude: "Longitude",
    installation_location: "Installation type",
    installation_location_other: "Installation type (other)",
    disco_info: "DISCO / electricity provider",
    bill_reference_number: "Bill reference number",
    solar_panel_capacity: "PV capacity",
    inverter_capacity: "Inverter capacity",
    inverter_serial_number: "Inverter serial",
    solar_connection_date: "Solar connection date",
    electricity_connection_date: "Electricity connection date",
    green_connection_date: "Green connection date",
    meter_model: "Meter model",
    meter_serial_number: "Meter serial",
    remarks: "Technical remarks",
  };

  const validateStep = (stepToValidate: number) => {
    const requiredFields = REQUIRED_FIELDS_BY_STEP[stepToValidate] ?? [];
    const missing = requiredFields.filter(
      (field) => !String(formData[field]).trim(),
    );

    if (
      stepToValidate === 1 &&
      requiredFields.includes("installation_location") &&
      formData.installation_location === "Other" &&
      !formData.installation_location_other.trim()
    ) {
      missing.push("installation_location_other");
    }

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
        icon={<Sun />}
        title={isEditMode ? "Edit solar site" : "Register solar site"}
        description={
          isEditMode
            ? "Update PV assets and metering for this location."
            : "Register a new solar site for monitoring and monthly logging."
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
          <AlertTitle>Other sites already at this location</AlertTitle>
          <AlertDescription>
            You can register another solar site for the same tehsil, village,
            and settlement. Each site gets its own unique ID.
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
                <SearchableOptionField
                  hideLabel
                  label="Village"
                  value={formData.village}
                  options={villageOptions}
                  disabled={!formData.tehsil || isEditMode}
                  placeholder={
                    formData.tehsil
                      ? "Type to find a village…"
                      : "Select a tehsil first"
                  }
                  onChange={(v) => {
                    void handleFieldChange("village", v);
                  }}
                />
              </FormField>

              <FormField
                label="Settlement"
                description="Optional — leave blank if not mapped."
              >
                <SearchableOptionField
                  hideLabel
                  label="Settlement"
                  value={formData.settlement}
                  options={settlementOptions}
                  allValue=""
                  allLabel="None"
                  disabled={!formData.village || isEditMode}
                  placeholder={
                    formData.village
                      ? "Type to find a settlement…"
                      : "Select a village first"
                  }
                  onChange={(v) => {
                    void handleFieldChange("settlement", v);
                  }}
                />
              </FormField>

              <FormField
                label="Installation type"
                required
                description="Rooftop, ground-mounted, or other."
              >
                <Select
                  value={installationTypeValue}
                  onValueChange={(v) => {
                    if (!v) return;
                    setFormData((prev) => ({
                      ...prev,
                      installation_location: v,
                      installation_location_other:
                        v === "Other" ? prev.installation_location_other : "",
                    }));
                  }}
                >
                  <SelectTrigger className={cn("w-full", inputClass)}>
                    <SelectValue placeholder="Select installation type" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {INSTALLATION_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.installation_location === "Other" ? (
                  <Input
                    name="installation_location_other"
                    value={formData.installation_location_other}
                    onChange={handleChange}
                    placeholder="Describe installation type"
                    className={cn(inputClass, "mt-2")}
                    disabled={loading}
                  />
                ) : null}
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
              <FormField label="DISCO / electricity provider" required>
                <Select
                  value={formData.disco_info || undefined}
                  onValueChange={(v) => {
                    if (v) {
                      setFormData((prev) => ({ ...prev, disco_info: v }));
                    }
                  }}
                >
                  <SelectTrigger className={cn("w-full", inputClass)}>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {DISCO_OPTIONS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Bill reference number" required>
                <Input
                  name="bill_reference_number"
                  value={formData.bill_reference_number}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Electricity bill reference"
                  disabled={loading}
                />
              </FormField>

              <FormField label="PV capacity (kWp)" required>
                <Input
                  type="number"
                  step="0.1"
                  name="solar_panel_capacity"
                  value={formData.solar_panel_capacity}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="0.0"
                  disabled={loading}
                />
              </FormField>

              <FormField label="Inverter capacity (kVA)" required>
                <Input
                  type="number"
                  step="0.1"
                  name="inverter_capacity"
                  value={formData.inverter_capacity}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="0.0"
                  disabled={loading}
                />
              </FormField>

              <FormField label="Inverter serial" required>
                <Input
                  name="inverter_serial_number"
                  value={formData.inverter_serial_number}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={loading}
                />
              </FormField>

              <FormField label="Solar connection date" required>
                <Input
                  type="date"
                  name="solar_connection_date"
                  value={formData.solar_connection_date}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={loading}
                />
              </FormField>
            </FieldGroup>
          ) : null}

          {activeStep === 3 ? (
            <div className="space-y-5">
              <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label="Meter model" required>
                  <Input
                    name="meter_model"
                    value={formData.meter_model}
                    onChange={handleChange}
                    className={inputClass}
                    disabled={loading}
                  />
                </FormField>

                <FormField label="Meter serial" required>
                  <Input
                    name="meter_serial_number"
                    value={formData.meter_serial_number}
                    onChange={handleChange}
                    className={inputClass}
                    disabled={loading}
                  />
                </FormField>

                <FormField label="Electricity connection date" required>
                  <Input
                    type="date"
                    name="electricity_connection_date"
                    value={formData.electricity_connection_date}
                    onChange={handleChange}
                    className={inputClass}
                    disabled={loading}
                  />
                </FormField>

                <FormField label="Green connection date" required>
                  <Input
                    type="date"
                    name="green_connection_date"
                    value={formData.green_connection_date}
                    onChange={handleChange}
                    className={inputClass}
                    disabled={loading}
                  />
                </FormField>
              </FieldGroup>

              <FormField
                label="Technical remarks"
                description="Maintenance cycles, shadow analysis, or other notes."
              >
                <Textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  placeholder="Optional notes"
                  className="min-h-20 resize-none"
                  disabled={loading}
                />
              </FormField>
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
                  onClick={() => void handleSubmit()}
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

export default SolarSystemForm;
