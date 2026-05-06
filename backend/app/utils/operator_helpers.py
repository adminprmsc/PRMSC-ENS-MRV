"""Shared parsing / lookup helpers for operator (tehsil + tubewell) routes."""

from datetime import datetime

from sqlalchemy import or_

from app.models.models import (
    SolarSystem,
    SystemMeter,
    METER_TYPE_SOLAR,
    METER_TYPE_TUBEWELL,
)


def parse_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except Exception:
        return None


ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "pdf"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def find_solar_system_by_location(
    tehsil_canonical: str, village: str, settlement_raw: str | None
):
    if not village:
        return None
    st = (settlement_raw or "").strip()
    if st:
        return SolarSystem.query.filter_by(
            tehsil=tehsil_canonical, village=village, settlement=st
        ).first()
    return (
        SolarSystem.query.filter_by(tehsil=tehsil_canonical, village=village)
        .filter(or_(SolarSystem.settlement.is_(None), SolarSystem.settlement == ""))
        .first()
    )


def coerce_optional_float(val):
    if val is None or val == "":
        return None
    if isinstance(val, bool):
        raise ValueError(f"Invalid numeric value: {val!r}")
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(str(val).strip())
    except ValueError:
        raise ValueError(f"Invalid numeric value: {val!r}")


def coerce_optional_str(value):
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def meter_to_dict(meter: SystemMeter | None) -> dict | None:
    if not meter:
        return None
    return {
        "id": str(meter.id),
        "meter_type": meter.meter_type,
        "meter_model": meter.meter_model,
        "meter_serial_number": meter.meter_serial_number,
        "meter_accuracy_class": meter.meter_accuracy_class,
        "installation_date": meter.installation_date.isoformat()
        if meter.installation_date
        else None,
        "is_active": bool(meter.is_active),
        "created_at": meter.created_at.isoformat() if meter.created_at else None,
        "updated_at": meter.updated_at.isoformat() if meter.updated_at else None,
    }


def upsert_active_system_meter(
    *,
    meter_type: str,
    water_system_id: str | None = None,
    solar_system_id: str | None = None,
    meter_model: str | None = None,
    meter_serial_number: str | None = None,
    meter_accuracy_class: str | None = None,
    installation_date=None,
    update_mode: str = "auto",
):
    if meter_type not in {METER_TYPE_TUBEWELL, METER_TYPE_SOLAR}:
        raise ValueError("Invalid meter_type")
    if bool(water_system_id) == bool(solar_system_id):
        raise ValueError("Exactly one system id is required for meter upsert")

    model = coerce_optional_str(meter_model)
    serial = coerce_optional_str(meter_serial_number)
    accuracy = coerce_optional_str(meter_accuracy_class)
    has_payload = any([model, serial, accuracy, installation_date])

    filters = {
        "meter_type": meter_type,
        "water_system_id": water_system_id,
        "solar_system_id": solar_system_id,
    }
    current = (
        SystemMeter.query.filter_by(**filters, is_active=True)
        .order_by(SystemMeter.created_at.desc())
        .first()
    )

    if not has_payload:
        if current:
            current.is_active = False
        return None

    if update_mode not in {"auto", "update_current", "switch_new"}:
        raise ValueError("Invalid meter update mode")

    if update_mode == "update_current" and current:
        current.meter_model = model
        current.meter_serial_number = serial
        current.meter_accuracy_class = accuracy
        current.installation_date = installation_date
        current.is_active = True
        return current

    if (
        current
        and current.meter_model == model
        and current.meter_serial_number == serial
        and current.meter_accuracy_class == accuracy
        and current.installation_date == installation_date
    ):
        return current

    if current:
        current.is_active = False

    meter = SystemMeter(
        meter_type=meter_type,
        water_system_id=water_system_id,
        solar_system_id=solar_system_id,
        meter_model=model,
        meter_serial_number=serial,
        meter_accuracy_class=accuracy,
        installation_date=installation_date,
        is_active=True,
    )
    return meter
