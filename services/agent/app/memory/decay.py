"""Refuerzo y decaimiento de confianza de memorias.

La confianza almacenada se refuerza con el uso y el feedback positivo, y la
confianza EFECTIVA (la que decide si una memoria entra al prompt) decae con el
tiempo sin uso. Lazy: se computa en retrieval, sin jobs periódicos.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

HALF_LIFE_DAYS = 90.0
MIN_EFFECTIVE_CONFIDENCE = 0.25
REINFORCE_STEP = 0.05
NEGATIVE_FEEDBACK_STEP = 0.2


def effective_confidence(stored: float, last_used_at: datetime | None, created_at: datetime) -> float:
    anchor = last_used_at or created_at
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=timezone.utc)
    days_idle = max(0.0, (datetime.now(timezone.utc) - anchor).total_seconds() / 86400)
    return stored * math.exp(-math.log(2) * days_idle / HALF_LIFE_DAYS)


def reinforced(stored: float) -> float:
    return min(1.0, stored + REINFORCE_STEP)


def penalized(stored: float) -> float:
    return max(0.0, stored - NEGATIVE_FEEDBACK_STEP)
