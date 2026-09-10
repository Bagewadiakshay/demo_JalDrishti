"""
Recommendation engine.

BUG FIXES vs TypeScript services/recommendation.ts:
- Uses strict type checks; `generate_recommendation` always returns a
  non-empty string even when every check is in a weird edge state.
- Accepts the pydantic schema directly — no internal type gymnastics.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .impact_score import calculate_impact_score
from ..schemas import InterventionBase


Severity = Literal["success", "warning", "danger"]


@dataclass
class RuleCheck:
    label: str
    pass_: bool
    severity: Severity


def evaluate_intervention(intervention: InterventionBase) -> list[RuleCheck]:
    checks: list[RuleCheck] = []

    if intervention.condition in {"Excellent", "Good"}:
        checks.append(RuleCheck("Structure condition is good", True, "success"))
    elif intervention.condition == "Moderate":
        checks.append(RuleCheck("Structure condition is moderate", True, "warning"))
    else:
        checks.append(RuleCheck("Structure condition is poor", False, "danger"))

    ndvi_delta = intervention.ndviAfter - intervention.ndviBefore
    if ndvi_delta > 0.08:
        checks.append(RuleCheck("Vegetation response is positive", True, "success"))
    elif ndvi_delta >= 0:
        checks.append(RuleCheck("Vegetation response is marginal", True, "warning"))
    else:
        checks.append(RuleCheck("NDVI declining", False, "danger"))

    ndwi_delta = intervention.ndwiAfter - intervention.ndwiBefore
    water_types = {"Check Dam", "Farm Pond"}
    if intervention.type in water_types:
        if intervention.waterPresent and intervention.waterAreaAfter > intervention.waterAreaBefore:
            checks.append(RuleCheck("Water indicator improved", True, "success"))
        elif ndwi_delta >= 0:
            checks.append(RuleCheck("Water indicator stable", True, "warning"))
        else:
            checks.append(RuleCheck("NDWI declining", False, "danger"))
    else:
        if ndvi_delta > 0.05:
            checks.append(RuleCheck("Land cover response positive", True, "success"))
        elif ndvi_delta >= 0:
            checks.append(RuleCheck("Land cover stable", True, "warning"))
        else:
            checks.append(RuleCheck("Land cover declining", False, "danger"))

    if intervention.confidence >= 80:
        checks.append(RuleCheck("AI interpretation confidence is high", True, "success"))
    elif intervention.confidence >= 60:
        checks.append(RuleCheck("AI confidence is moderate", True, "warning"))
    else:
        checks.append(RuleCheck("AI confidence is low — verify in field", False, "warning"))

    if intervention.rainfallChange >= 5:
        checks.append(RuleCheck("Rainfall context is favorable", True, "success"))
    elif intervention.rainfallChange >= -3:
        checks.append(RuleCheck("Rainfall context neutral", True, "warning"))
    else:
        checks.append(
            RuleCheck(
                "Below-average rainfall may confound results", False, "warning"
            )
        )

    return checks


def generate_recommendation(intervention: InterventionBase) -> str:
    checks = evaluate_intervention(intervention)
    failures = sum(1 for c in checks if not c.pass_)
    dangers = sum(1 for c in checks if c.severity == "danger")
    impact = calculate_impact_score(intervention)

    if dangers >= 2:
        return (
            "Prioritize field verification and inspect the structure for damage or siltation. "
            "Recommend structural audit and immediate remediation works."
        )

    if intervention.condition == "Poor":
        return "Prioritize field verification and inspect the structure for damage or siltation."

    if failures >= 2:
        return (
            "Schedule detailed field assessment within 30 days. Review maintenance logs "
            "and consider targeted repairs or desilting before next monsoon."
        )

    if intervention.condition == "Moderate":
        if intervention.type in {"Check Dam", "Farm Pond"}:
            return (
                "Schedule desilting and minor repairs in the next dry season "
                "to restore full design capacity."
            )
        return (
            "Plan supplementary maintenance: gap filling (plantations) or reshaping "
            "(trenches) during next operational window."
        )

    if impact.score >= 85:
        return (
            "Outstanding performance. Continue current maintenance schedule and consider "
            "as a demonstration site for knowledge sharing."
        )

    if impact.score >= 70:
        return "Continue periodic monitoring. No immediate intervention required."

    return "Continue current monitoring cadence. Reassess after next season field survey and satellite pass."
