"""
Pydantic v2 schemas — full field parity with the React frontend types.

BUG FIXES vs TypeScript schemas/intervention.ts:
- 30+ new Kasari River Basin morphological fields are present
- Label/type enums use Literal types so `calculateImpactScore` label return type
  matches the Intervention.risk_level field (fixes TS bug: ImpactBreakdown.label
  was `string` but cast to enum)
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


InterventionType = Literal["Check Dam", "Farm Pond", "Plantation", "Contour Trench"]
InterventionCondition = Literal["Excellent", "Good", "Moderate", "Poor"]
RiskLevel = Literal["High Impact", "Moderate Impact", "At Risk", "Needs Review"]


class StreamOrderRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    streamNumber: int
    streamOrder: int
    totalStreamLength: float
    meanStreamLength: float
    streamLengthRatio: Optional[float] = None
    bifurcationRatio: Optional[float] = None


class LandUse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    agriculture: float
    forest: float
    wasteland: float
    waterBody: float
    builtUp: float


class MorphologicalParamsSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    elevation: float
    slope: float
    aspect: str
    drainageDensity: float
    streamOrder: int
    watershedArea: float
    basinLength: float
    basinWidth: float
    circularityRatio: float
    elongationRatio: float
    formFactor: float
    ruggednessNumber: float
    reliefRatio: float
    totalRelief: float
    meanSlope: float
    textureRatio: float
    landUse: LandUse
    soilType: str
    soilDepth: float
    infiltrationRate: float

    # Kasari River Basin additions
    basinArea: float = 627.687
    basinPerimeter: float = 171.229
    totalStreamNumber: int = 650
    totalStreamLength: float = 638.0
    streamFrequency: float = 1.035547972
    drainageTexture: float = 3.796085943
    compactnessCoefficient: float = 2.107245354
    constantChannelMaintenance: float = 0.983835423
    infiltrationNumber: float = 1.052562195
    drainageIntensity: float = 1.018808777
    lemniscateRatio: float = 0.983806419
    timeOfConcentration: float = 18.3298916
    maximumElevation: float = 947.8
    minimumElevation: float = 456.82
    meanElevation: float = 584.41
    meanBasinSlope: float = 9.6
    hypsometricIntegral: float = 0.259868019
    relativeRelief: float = 2.867388118
    dissectionIndex: float = 0.518020679
    meltonRuggednessNumber: float = 9.672033781
    gradientRatio: float = 9.878873239
    channelGradient: float = 3.128456735
    lengthOfOverlandFlow: float = 0.491917712
    meanBifurcationRatio: float = 1.95260987
    meanStreamLengthBasin: float = 156.94
    streamOrderTable: list[StreamOrderRow] = Field(default_factory=list)


class StreamFlowSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    min: float
    max: float
    mean: float


class HydrologicalParamsSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    annualRainfall: float
    monsoonRainfall: float
    runoffCoefficient: float
    annualRunoff: float
    peakDischarge: float
    baseFlow: float
    groundwaterLevel: float
    groundwaterRecharge: float
    evapotranspiration: float
    soilMoisture: float
    waterYield: float
    sedimentYield: float
    floodFrequency: float
    droughtIndex: float
    streamFlow: StreamFlowSchema
    reservoirCapacity: float
    storageEfficiency: float
    infiltrationLoss: float
    surfaceRunoff: float
    subSurfaceFlow: float


class NDVITimeSeriesPointSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    year: int
    value: float


class ImpactBreakdownSchema(BaseModel):
    score: int
    vegetation: int
    water: int
    landCover: int
    structure: int
    hydrological: int
    rainfallAdjusted: int
    label: RiskLevel


# --------------------------------------------------------------------------- #
# Intervention base + CRUD schemas
# --------------------------------------------------------------------------- #

class InterventionBase(BaseModel):
    type: InterventionType
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    village: str = Field(..., min_length=1)
    constructionYear: int = Field(..., ge=1900, le=2100)
    condition: InterventionCondition
    confidence: float = Field(..., ge=0, le=100)
    photo: Optional[str] = None
    captureDate: str = Field(..., min_length=1)
    waterPresent: bool = False
    ndviBefore: float = Field(..., ge=-1, le=1)
    ndviAfter: float = Field(..., ge=-1, le=1)
    ndwiBefore: float = Field(..., ge=-1, le=1)
    ndwiAfter: float = Field(..., ge=-1, le=1)
    waterAreaBefore: float = Field(..., ge=0)
    waterAreaAfter: float = Field(..., ge=0)
    rainfallChange: float
    ndviTimeSeries: list[NDVITimeSeriesPointSchema]
    morphological: MorphologicalParamsSchema
    hydrological: HydrologicalParamsSchema
    notes: Optional[str] = None


class InterventionCreate(InterventionBase):
    id: Optional[str] = Field(default=None, min_length=1)


class InterventionUpdate(InterventionBase):
    # All fields optional for partial update — override the base required ones.
    type: Optional[InterventionType] = None  # type: ignore[assignment]
    latitude: Optional[float] = None  # type: ignore[assignment]
    longitude: Optional[float] = None  # type: ignore[assignment]
    village: Optional[str] = None  # type: ignore[assignment]
    constructionYear: Optional[int] = None  # type: ignore[assignment]
    condition: Optional[InterventionCondition] = None  # type: ignore[assignment]
    confidence: Optional[float] = None  # type: ignore[assignment]
    captureDate: Optional[str] = None  # type: ignore[assignment]
    waterPresent: Optional[bool] = None  # type: ignore[assignment]
    ndviBefore: Optional[float] = None  # type: ignore[assignment]
    ndviAfter: Optional[float] = None  # type: ignore[assignment]
    ndwiBefore: Optional[float] = None  # type: ignore[assignment]
    ndwiAfter: Optional[float] = None  # type: ignore[assignment]
    waterAreaBefore: Optional[float] = None  # type: ignore[assignment]
    waterAreaAfter: Optional[float] = None  # type: ignore[assignment]
    rainfallChange: Optional[float] = None  # type: ignore[assignment]
    ndviTimeSeries: Optional[list[NDVITimeSeriesPointSchema]] = None  # type: ignore[assignment]
    morphological: Optional[MorphologicalParamsSchema] = None  # type: ignore[assignment]
    hydrological: Optional[HydrologicalParamsSchema] = None  # type: ignore[assignment]
    id: Optional[str] = None


class InterventionSchema(InterventionBase):
    id: str
    impactScore: int
    riskLevel: RiskLevel
    recommendation: str
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    @field_validator("id", mode="before")
    @classmethod
    def ensure_id_str(cls, v: object) -> str:
        return str(v) if v is not None else ""
