from flask import Blueprint, request, jsonify
from datetime import date
from app.extensions import db
from app.models.models import (
    WaterSystem,
    WaterEnergyLoggingDaily,
    SolarSystem,
    SystemMeter,
    SolarEnergyLoggingMonthly,
    SUBMISSION_STATUS_REJECTED,
    METER_TYPE_TUBEWELL,
)
from sqlalchemy import extract, func, or_

dashboard_bp = Blueprint('dashboard', __name__)


def _log_not_rejected():
    """SQL-safe: include NULL status (legacy rows) and every status except rejected."""
    return or_(
        WaterEnergyLoggingDaily.status.is_(None),
        WaterEnergyLoggingDaily.status != SUBMISSION_STATUS_REJECTED,
    )


def _apply_location_filters(query, tehsil, village, *, model):
    if tehsil and tehsil != "All Tehsils":
        query = query.filter(model.tehsil == tehsil)
    if village and village != "All Villages":
        query = query.filter(model.village == village)
    return query


def _apply_log_date_filters(query, month, year):
    """Apply index-friendly date range filters instead of extract() predicates."""
    if year and month:
        start = date(year, month, 1)
        end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
        return query.filter(
            WaterEnergyLoggingDaily.log_date >= start,
            WaterEnergyLoggingDaily.log_date < end,
        )
    if year:
        return query.filter(
            WaterEnergyLoggingDaily.log_date >= date(year, 1, 1),
            WaterEnergyLoggingDaily.log_date < date(year + 1, 1, 1),
        )
    if month:
        return query.filter(extract("month", WaterEnergyLoggingDaily.log_date) == month)
    return query


@dashboard_bp.route('/program-summary', methods=['GET'])
def get_program_summary():
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    
    ws_query = _apply_location_filters(
        db.session.query(func.count(WaterSystem.id)),
        tehsil,
        village,
        model=WaterSystem,
    )
    ss_query = _apply_location_filters(
        db.session.query(func.count(SolarSystem.id)),
        tehsil,
        village,
        model=SolarSystem,
    )

    ohr_count = ws_query.scalar() or 0
    solar_facilities = ss_query.scalar() or 0

    bulk_meters = (
        db.session.query(func.count(SystemMeter.id))
        .join(WaterSystem, WaterSystem.id == SystemMeter.water_system_id)
        .filter(
            SystemMeter.meter_type == METER_TYPE_TUBEWELL,
            SystemMeter.is_active.is_(True),
        )
    )
    bulk_meters = _apply_location_filters(
        bulk_meters, tehsil, village, model=WaterSystem
    )
    bulk_meters = bulk_meters.scalar() or 0
    
    return jsonify({
        "ohr_count": ohr_count,
        "solar_facilities": solar_facilities,
        "bulk_meters": bulk_meters
    }), 200

@dashboard_bp.route('/water-supplied', methods=['GET'])
def get_water_supplied():
    """Monthly m³: sum of daily `total_water_pumped` per calendar month for all water systems.

    Not restricted to “bulk meter” systems only — if `meter_serial_number` is missing in the
    registry but the operator still logged volume, it still counts here. Rejected logs excluded.
    """
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    month = request.args.get('month', type=int)
    year = request.args.get('year', type=int)
    
    w_m = extract("month", WaterEnergyLoggingDaily.log_date)
    query = (
        db.session.query(
            w_m.label("month"),
            func.sum(
                func.coalesce(WaterEnergyLoggingDaily.total_water_pumped, 0.0)
            ).label("total"),
        )
        .filter(_log_not_rejected())
    )

    if (tehsil and tehsil != "All Tehsils") or (village and village != "All Villages"):
        query = query.join(WaterSystem, WaterEnergyLoggingDaily.water_system_id == WaterSystem.id)
        query = _apply_location_filters(query, tehsil, village, model=WaterSystem)
    query = _apply_log_date_filters(query, month, year)

    query = query.group_by(w_m).order_by(w_m)
    results = query.all()

    data_dict = {int(r.month): float(r.total or 0) for r in results}
    data = [{"month": m, "total_water_pumped": data_dict.get(m, 0)} for m in range(1, 13)]

    return jsonify(data), 200

@dashboard_bp.route('/pump-hours', methods=['GET'])
def get_pump_hours():
    """Monthly pump run time: sum of daily `pump_operating_hours` for all water systems.

    Same rows may also contribute to `/water-supplied` (m³) when both volume and hours are
    logged — e.g. flow-metered sites can still record pump time. Not filtered by bulk meter
    on the system record. Rejected logs excluded.
    """
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    month = request.args.get('month', type=int)
    year = request.args.get('year', type=int)
    
    w_m = extract("month", WaterEnergyLoggingDaily.log_date)
    query = (
        db.session.query(
            w_m.label("month"),
            func.sum(
                func.coalesce(WaterEnergyLoggingDaily.pump_operating_hours, 0.0)
            ).label("total"),
        )
        .filter(_log_not_rejected())
    )

    if (tehsil and tehsil != "All Tehsils") or (village and village != "All Villages"):
        query = query.join(WaterSystem, WaterEnergyLoggingDaily.water_system_id == WaterSystem.id)
        query = _apply_location_filters(query, tehsil, village, model=WaterSystem)
    query = _apply_log_date_filters(query, month, year)

    query = query.group_by(w_m).order_by(w_m)
    results = query.all()

    data_dict = {int(r.month): float(r.total or 0) for r in results}
    data = [{"month": m, "pump_operating_hours": data_dict.get(m, 0)} for m in range(1, 13)]
    
    return jsonify(data), 200

@dashboard_bp.route('/solar-generation', methods=['GET'])
def get_solar_generation():
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    month = request.args.get('month', type=int)
    year = request.args.get('year', type=int)
    
    query = db.session.query(
        SolarEnergyLoggingMonthly.month,
        func.sum(SolarEnergyLoggingMonthly.energy_exported_to_grid).label("total"),
    )

    if (tehsil and tehsil != "All Tehsils") or (village and village != "All Villages"):
        query = query.join(SolarSystem, SolarEnergyLoggingMonthly.solar_system_id == SolarSystem.id)
        query = _apply_location_filters(query, tehsil, village, model=SolarSystem)
    if month:
        query = query.filter(SolarEnergyLoggingMonthly.month == month)
    if year:
        query = query.filter(SolarEnergyLoggingMonthly.year == year)

    query = query.group_by(SolarEnergyLoggingMonthly.month).order_by(
        SolarEnergyLoggingMonthly.month
    )
    results = query.all()
    
    data_dict = {r.month: float(r.total or 0) for r in results}
    data = [{"month": m, "solar_generation_kwh": data_dict.get(m, 0)} for m in range(1, 13)]
    
    return jsonify(data), 200

@dashboard_bp.route('/grid-import', methods=['GET'])
def get_grid_import():
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    month = request.args.get('month', type=int)
    year = request.args.get('year', type=int)
    
    query = db.session.query(
        SolarEnergyLoggingMonthly.month,
        func.sum(SolarEnergyLoggingMonthly.energy_consumed_from_grid).label("total"),
    )

    if (tehsil and tehsil != "All Tehsils") or (village and village != "All Villages"):
        query = query.join(SolarSystem, SolarEnergyLoggingMonthly.solar_system_id == SolarSystem.id)
        query = _apply_location_filters(query, tehsil, village, model=SolarSystem)
    if month:
        query = query.filter(SolarEnergyLoggingMonthly.month == month)
    if year:
        query = query.filter(SolarEnergyLoggingMonthly.year == year)

    query = query.group_by(SolarEnergyLoggingMonthly.month).order_by(
        SolarEnergyLoggingMonthly.month
    )
    results = query.all()
    
    data_dict = {r.month: float(r.total or 0) for r in results}
    data = [{"month": m, "grid_import_kwh": data_dict.get(m, 0)} for m in range(1, 13)]
    
    return jsonify(data), 200
