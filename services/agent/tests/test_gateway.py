"""Mapeo del manifest de tools TS al formato function-calling de OpenAI/DeepSeek."""
from app.tools.gateway import manifest_to_openai_tools


def test_mapea_manifest_completo():
    manifest = [
        {
            "name": "auditar_subcontratos",
            "description": "Audita vencimientos",
            "inputSchema": {"type": "object", "properties": {"projectId": {"type": "string"}}},
        }
    ]
    [tool] = manifest_to_openai_tools(manifest)
    assert tool["type"] == "function"
    assert tool["function"]["name"] == "auditar_subcontratos"
    assert tool["function"]["parameters"]["properties"]["projectId"]["type"] == "string"


def test_defaults_para_campos_faltantes():
    [tool] = manifest_to_openai_tools([{"name": "t"}])
    assert tool["function"]["description"] == ""
    assert tool["function"]["parameters"] == {"type": "object"}
