from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.memory.reflection import process_feedback

router = APIRouter()


class ProcessFeedbackRequest(BaseModel):
    feedbackId: str


@router.post("/v1/feedback/process")
async def feedback_process(
    body: ProcessFeedbackRequest,
    x_agent_secret: str | None = Header(default=None),
) -> dict:
    expected = get_settings().agent_gateway_secret
    if not expected or x_agent_secret != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")
    processed = await process_feedback(body.feedbackId)
    return {"ok": True, "processed": processed}
