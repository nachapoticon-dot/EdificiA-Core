"""Cliente del tool gateway de Next.js.

El cerebro vive acá; las ~45 tools TS existentes (cálculo, generación de
documentos, escrituras de obra) se ejecutan vía /api/internal/tools/* con
org-binding server-side. Migración gradual de tools a Python después.
"""
from __future__ import annotations

from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_fixed

from app.config import get_settings


class ToolGateway:
    def __init__(self) -> None:
        settings = get_settings()
        self._base = settings.nextjs_internal_url.rstrip("/")
        self._headers = {"x-agent-secret": settings.agent_gateway_secret}
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0))

    async def close(self) -> None:
        await self._client.aclose()

    @retry(stop=stop_after_attempt(2), wait=wait_fixed(0.5), reraise=True)
    async def manifest(self) -> list[dict[str, Any]]:
        res = await self._client.get(f"{self._base}/api/internal/tools/manifest", headers=self._headers)
        res.raise_for_status()
        return res.json()["tools"]

    async def context(
        self,
        *,
        org_id: str,
        user_id: str,
        project_name: str | None,
        project_id: str | None,
        chat_session_id: str | None,
    ) -> dict[str, Any]:
        res = await self._client.post(
            f"{self._base}/api/internal/agent/context",
            headers=self._headers,
            json={
                "orgId": org_id,
                "userId": user_id,
                **({"projectName": project_name} if project_name else {}),
                **({"projectId": project_id} if project_id else {}),
                **({"chatSessionId": chat_session_id} if chat_session_id else {}),
            },
        )
        res.raise_for_status()
        return res.json()

    async def execute(
        self,
        *,
        tool_name: str,
        tool_input: dict[str, Any],
        org_id: str,
        user_id: str,
        project_id: str | None,
        work_case_id: str | None,
    ) -> dict[str, Any]:
        """Devuelve {ok, output|error}. Nunca lanza por fallas de la tool."""
        try:
            res = await self._client.post(
                f"{self._base}/api/internal/tools/execute",
                headers=self._headers,
                json={
                    "toolName": tool_name,
                    "input": tool_input,
                    "context": {
                        "orgId": org_id,
                        "userId": user_id,
                        **({"projectId": project_id} if project_id else {}),
                        **({"workCaseId": work_case_id} if work_case_id else {}),
                    },
                },
            )
            return res.json()
        except Exception as err:  # noqa: BLE001 — el loop decide cómo informar al modelo
            return {"ok": False, "error": f"tool gateway error: {err}"}


def manifest_to_openai_tools(manifest: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description") or "",
                "parameters": t.get("inputSchema") or {"type": "object"},
            },
        }
        for t in manifest
    ]
