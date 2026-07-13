"""Shared utility functions for writer power analysis nodes."""

from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import quote

from .constants import (
    CHAT_COMPLETIONS_RE,
    DATA_PREFIX_RE,
    DEFAULT_BASE_URL,
    DEFAULT_MODEL_LIST_PATH,
    DEFAULT_TEMPERATURE,
    GEMINI_GENERATE_RE,
    TRAILING_COMMA_RE,
)
from .models import EndpointCandidate


def safe_str(value: Any, default: str = "") -> str:
    """Return a stripped string or a default."""

    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def safe_float(value: Any, default: float, minimum: float, maximum: float) -> float:
    """Return a bounded float."""

    try:
        number = float(value)
    except (TypeError, ValueError):
        number = default
    return max(minimum, min(maximum, number))


def safe_int(value: Any, default: int, minimum: int, maximum: int) -> int:
    """Return a bounded integer."""

    try:
        number = int(value)
    except (TypeError, ValueError):
        number = default
    return max(minimum, min(maximum, number))


def safe_bool(value: Any, default: bool) -> bool:
    """Return a conservative boolean from config input."""

    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
    if value is None:
        return default
    return bool(value)


def as_string_list(value: Any, default: list[str]) -> list[str]:
    """Normalize a config value into a string list."""

    if isinstance(value, list):
        items = [safe_str(item) for item in value]
        return [item for item in items if item]
    if isinstance(value, str):
        items = [safe_str(item) for item in value.split(",")]
        return [item for item in items if item]
    return list(default)


def is_gemini_model(model: str) -> bool:
    """Return whether a model id should use the Gemini generateContent API."""

    return "gemini" in model.lower()


def normalize_base_url(base_url: str) -> str:
    """Normalize a base URL without a trailing slash."""

    return base_url.rstrip("/") if base_url else ""


def build_gemini_v1beta_base(base_url: str) -> str:
    """Build a Gemini v1beta base URL."""

    if base_url.endswith("/v1beta"):
        return base_url
    if re.search(r"/v\d+$", base_url):
        return re.sub(r"/v\d+$", "/v1beta", base_url)
    return f"{base_url}/v1beta"


def build_model_list_url(base_url: str, model_list_path: str) -> str:
    """Build the model-list endpoint from config."""

    normalized = normalize_base_url(base_url)
    path = model_list_path.strip() or DEFAULT_MODEL_LIST_PATH
    if path.startswith("http://") or path.startswith("https://"):
        return path
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{normalized}{path}"


def build_endpoint_candidates(base_url: str, model: str) -> list[EndpointCandidate]:
    """Build likely completion endpoints in priority order."""

    normalized = normalize_base_url(base_url)
    encoded_model = quote(model, safe="")

    if GEMINI_GENERATE_RE.search(normalized):
        return [EndpointCandidate(normalized, "gemini")]
    if CHAT_COMPLETIONS_RE.search(normalized):
        return [EndpointCandidate(normalized, "openai")]

    candidates: list[EndpointCandidate] = []
    if is_gemini_model(model):
        gemini_base = build_gemini_v1beta_base(normalized)
        candidates.append(EndpointCandidate(f"{gemini_base}/models/{encoded_model}:generateContent", "gemini"))

    if re.search(r"/v\d+$", normalized):
        candidates.append(EndpointCandidate(f"{normalized}/chat/completions", "openai"))
    else:
        candidates.extend(
            [
                EndpointCandidate(f"{normalized}/chat/completions", "openai"),
                EndpointCandidate(f"{normalized}/v1/chat/completions", "openai"),
            ]
        )
    return candidates


def strip_code_fence(text: str) -> str:
    """Remove an outer Markdown code fence when present."""

    trimmed = text.strip()
    if not trimmed.startswith("```"):
        return trimmed
    first_newline = trimmed.find("\n")
    closing = trimmed.rfind("```")
    if first_newline == -1 or closing <= first_newline:
        return trimmed
    return trimmed[first_newline + 1 : closing].strip()


def find_json_object_end(text: str, start: int) -> int:
    """Find the balanced end offset of the first JSON object."""

    depth = 0
    in_string = False
    escaped = False
    for index, char in enumerate(text[start:], start=start):
        if escaped:
            escaped = False
            continue
        if char == "\\" and in_string:
            escaped = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return index
    return -1


def extract_json_object(text: str) -> str:
    """Extract the first complete JSON object from model output."""

    stripped = strip_code_fence(text)
    start = stripped.find("{")
    if start == -1:
        raise ValueError("模型没有返回 JSON 对象")
    end = find_json_object_end(stripped, start)
    if end == -1:
        raise ValueError("模型返回的 JSON 对象不完整")
    return stripped[start : end + 1]


def fix_control_characters(json_text: str) -> str:
    """Escape invalid control characters inside JSON strings."""

    out: list[str] = []
    in_string = False
    escaped = False
    for char in json_text:
        code = ord(char)
        if escaped:
            escaped = False
            out.append(char)
            continue
        if char == "\\" and in_string:
            escaped = True
            out.append(char)
            continue
        if char == '"':
            in_string = not in_string
            out.append(char)
            continue
        if in_string and code < 0x20:
            if char == "\n":
                out.append("\\n")
            elif char == "\r":
                out.append("\\r")
            elif char == "\t":
                out.append("\\t")
            else:
                out.append(f"\\u{code:04x}")
            continue
        out.append(char)
    return "".join(out)


def parse_model_json(raw: str) -> dict[str, Any]:
    """Parse model JSON with small recovery steps for common LLM issues."""

    json_text = extract_json_object(raw)
    try:
        parsed = json.loads(json_text)
    except json.JSONDecodeError:
        fixed = fix_control_characters(TRAILING_COMMA_RE.sub(r"\1", json_text))
        parsed = json.loads(fixed)
    if not isinstance(parsed, dict):
        raise ValueError("模型返回的 JSON 顶层不是对象")
    return parsed


def parse_completion_response(raw_text: str) -> dict[str, Any]:
    """Parse a completion HTTP response without assuming strict JSON body shape."""

    trimmed = raw_text.strip()
    if not trimmed:
        return {"raw_text": raw_text}
    try:
        parsed = json.loads(trimmed)
        if isinstance(parsed, dict):
            return {"parsed": parsed, "raw_text": raw_text}
    except json.JSONDecodeError:
        pass

    data_line = ""
    for line in trimmed.splitlines():
        candidate = line.strip()
        if candidate.startswith("data:") and candidate != "data: [DONE]":
            data_line = candidate
            break
    candidate_text = DATA_PREFIX_RE.sub("", data_line or trimmed)
    try:
        parsed = json.loads(extract_json_object(candidate_text))
        if isinstance(parsed, dict):
            return {"parsed": parsed, "raw_text": raw_text}
    except (json.JSONDecodeError, ValueError):
        pass
    return {"raw_text": raw_text}


def completion_content(payload: dict[str, Any]) -> str:
    """Extract assistant content from OpenAI-compatible or Gemini responses."""

    parsed = payload.get("parsed")
    if not isinstance(parsed, dict):
        return safe_str(payload.get("raw_text"))

    choices = parsed.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            message = first.get("message")
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, str):
                    return content

    candidates = parsed.get("candidates")
    if isinstance(candidates, list) and candidates:
        first = candidates[0]
        if isinstance(first, dict):
            content = first.get("content")
            if isinstance(content, dict):
                parts = content.get("parts")
                if isinstance(parts, list):
                    return "".join(part.get("text", "") for part in parts if isinstance(part, dict))

    return safe_str(payload.get("raw_text"))


def completion_error(payload: dict[str, Any], status_code: int) -> str:
    """Extract a readable upstream error."""

    parsed = payload.get("parsed")
    if isinstance(parsed, dict):
        error = parsed.get("error")
        if isinstance(error, dict):
            message = safe_str(error.get("message"))
            code = safe_str(error.get("code"))
            if message and code:
                return f"{code}: {message}"
            if message:
                return message
        if isinstance(error, str) and error:
            return error
    raw = safe_str(payload.get("raw_text"))
    return raw[:500] or f"模型接口请求失败 ({status_code})"


def is_unavailable_model_error(error_text: str) -> bool:
    """Return whether the selected model can safely fall back to another id."""

    normalized = error_text.lower()
    return (
        "model is not found" in normalized
        or "model not found" in normalized
        or "not supported" in normalized
        or '"code":"forbidden"' in normalized
        or "invalid_request_error" in normalized
        or "forbidden" in normalized
    )


def dimension_score(value: Any) -> float:
    """Parse a dimension score from model output."""

    try:
        return float(value or 0)
    except (TypeError, ValueError):
        match = re.search(r"-?\d+(?:\.\d+)?", str(value))
        return float(match.group(0)) if match else 0.0


def calculate_final_score(dimensions: list[dict[str, Any]]) -> float:
    """Calculate the Ink Battles backend final score from dimensions."""

    base_dimensions = [
        item
        for item in dimensions
        if "经典" not in safe_str(item.get("name")) and "新锐" not in safe_str(item.get("name"))
    ]
    base_score = sum(dimension_score(item.get("score")) for item in base_dimensions)
    classicity = next(
        (dimension_score(item.get("score")) for item in dimensions if "经典" in safe_str(item.get("name"))),
        1.0,
    )
    novelty = next(
        (dimension_score(item.get("score")) for item in dimensions if "新锐" in safe_str(item.get("name"))),
        1.0,
    )
    final_score = base_score * (classicity or 1.0) * (novelty or 1.0)
    return round(final_score, 2) if final_score == final_score else 0.0


def build_openai_payload(
    model: str,
    system_prompt: str,
    article_text: str,
    temperature: float,
    json_mode: bool,
) -> dict[str, Any]:
    """Build an OpenAI-compatible chat completion payload."""

    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": article_text},
        ],
        "temperature": temperature,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    return payload


def to_gemini_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Convert OpenAI-style messages to Gemini generateContent payload."""

    messages = payload.get("messages", [])
    system_parts: list[dict[str, str]] = []
    contents: list[dict[str, Any]] = []
    for message in messages if isinstance(messages, list) else []:
        if not isinstance(message, dict):
            continue
        role = message.get("role")
        content = safe_str(message.get("content"))
        if not content:
            continue
        if role == "system":
            system_parts.append({"text": content})
        else:
            contents.append({"role": "model" if role == "assistant" else "user", "parts": [{"text": content}]})

    generation_config: dict[str, Any] = {"temperature": payload.get("temperature", DEFAULT_TEMPERATURE)}
    if payload.get("response_format"):
        generation_config["responseMimeType"] = "application/json"

    gemini_payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": generation_config,
    }
    if system_parts:
        gemini_payload["systemInstruction"] = {"parts": system_parts}
    return gemini_payload


def normalize_analysis(parsed: dict[str, Any]) -> dict[str, Any]:
    """Normalize model JSON into the report schema expected by the plugin."""

    if not isinstance(parsed.get("dimensions"), list):
        raise ValueError("模型结果缺少 dimensions")

    dimensions = []
    for item in parsed.get("dimensions", []):
        if not isinstance(item, dict):
            continue
        score = dimension_score(item.get("score"))
        dimensions.append(
            {
                "name": safe_str(item.get("name"), "未命名维度"),
                "score": score,
                "description": safe_str(item.get("description")),
            }
        )

    def string_list(key: str) -> list[str]:
        value = parsed.get(key)
        if not isinstance(value, list):
            return []
        return [safe_str(item) for item in value if safe_str(item)]

    return {
        "overallScore": round(float(parsed["overallScore"]), 2)
        if isinstance(parsed.get("overallScore"), (int, float))
        else calculate_final_score(dimensions),
        "overallAssessment": safe_str(parsed.get("overallAssessment"), "模型未返回综合评价。"),
        "title": safe_str(parsed.get("title"), "未命名评价"),
        "ratingTag": safe_str(parsed.get("ratingTag"), "本地基础分析"),
        "finalTag": safe_str(parsed.get("finalTag"), "可作为基础创作参考"),
        "summary": safe_str(parsed.get("summary"), "模型未返回作品概述。"),
        "tags": string_list("tags"),
        "dimensions": dimensions,
        "strengths": string_list("strengths"),
        "improvements": string_list("improvements"),
        "excellentSentences": parsed.get("excellentSentences") if isinstance(parsed.get("excellentSentences"), list) else [],
        "authorMatches": parsed.get("authorMatches") if isinstance(parsed.get("authorMatches"), list) else [],
        "mermaid_diagrams": parsed.get("mermaid_diagrams") if isinstance(parsed.get("mermaid_diagrams"), list) else [],
    }


def format_report_markdown(analysis: dict[str, Any]) -> str:
    """Format a concise Chinese markdown report for chat display."""

    lines = [
        f"# {analysis.get('title') or '作家战力分析'}",
        "",
        f"综合战力评分：{analysis.get('overallScore')}/100",
        f"评级：{analysis.get('ratingTag')} / {analysis.get('finalTag')}",
        "",
        "## 作品概述",
        safe_str(analysis.get("summary")),
        "",
        "## 综合评价",
        safe_str(analysis.get("overallAssessment")),
        "",
        "## 维度评分",
    ]
    for dimension in analysis.get("dimensions", []):
        if not isinstance(dimension, dict):
            continue
        lines.append(f"- {dimension.get('name')}: {dimension.get('score')} - {dimension.get('description')}")

    strengths = analysis.get("strengths", [])
    if isinstance(strengths, list) and strengths:
        lines.extend(["", "## 优势"])
        lines.extend(f"- {safe_str(item)}" for item in strengths if safe_str(item))

    improvements = analysis.get("improvements", [])
    if isinstance(improvements, list) and improvements:
        lines.extend(["", "## 改进建议"])
        lines.extend(f"- {safe_str(item)}" for item in improvements if safe_str(item))

    return "\n".join(lines).strip()
