"""Writer power analysis business service."""

from __future__ import annotations

from typing import Any

from .config_resolve_node import ConfigResolveNode
from .model_list_node import ModelListNode
from .models import AnalysisConfig
from .pipeline import WriterAnalysisPipelineNode
from .status_node import StatusNode


class WriterPowerAnalysisService:
    """Business service owned by the plugin shell."""

    def __init__(self, logger: Any):
        self.config_resolve = ConfigResolveNode(logger)
        self.status_node = StatusNode(logger)
        self.model_list_node = ModelListNode(logger)
        self.analysis_pipeline = WriterAnalysisPipelineNode(logger)

    def resolve_config(self, raw_config: dict[str, Any], **kwargs: Any) -> AnalysisConfig:
        """Resolve runtime config through a logged node."""

        return self.config_resolve.run(raw_config, **kwargs)

    def status(self, raw_config: dict[str, Any], **kwargs: Any) -> dict[str, object]:
        """Return non-secret plugin status."""

        cfg = self.resolve_config(raw_config, **kwargs)
        return self.status_node.run(cfg)

    async def list_models(self, raw_config: dict[str, Any], **kwargs: Any) -> dict[str, object]:
        """Return configured upstream models or builtin fallback models."""

        cfg = self.resolve_config(raw_config, **kwargs)
        return await self.model_list_node.run(cfg)

    async def analyze(
        self,
        raw_config: dict[str, Any],
        article_text: str,
        mode: str = "standard",
        *,
        use_neko_model: bool = False,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Run full writer analysis."""

        cfg = self.resolve_config(raw_config, **kwargs)
        return await self.analysis_pipeline.run(cfg, article_text, mode, use_neko_model=use_neko_model)

    def get_neko_model(self) -> dict[str, object]:
        """Return Neko's current LLM model configuration.

        Reads from the main N.E.K.O config manager so the frontend
        can show which model Neko is currently using.
        """
        try:
            from utils.config_manager import get_config_manager

            config_manager = get_config_manager()
            cfg = config_manager.get_model_api_config("conversation")
            model = str(cfg.get("model") or "")
            base_url = str(cfg.get("base_url") or "")
            has_api_key = bool(cfg.get("api_key"))
            return {
                "available": bool(model),
                "model": model or "未知",
                "base_url": base_url or "Neko 默认端点",
                "has_api_key": has_api_key,
            }
        except Exception:
            return {
                "available": False,
                "model": "未知",
                "base_url": "",
                "has_api_key": False,
            }
