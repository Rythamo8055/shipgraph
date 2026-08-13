"""Deterministic repo -> statuspage service mapping (real product identity).

Only HashiCorp OSS products map to HashiCorp's own public cloud components
(HCP Terraform, HCP Packer). expressjs/vitejs are libraries with no owned
production service on any of the ingested status pages, so they intentionally
have NO DEPLOYED edges. Every DEPLOYED edge is heuristic:true.
"""
from schema import SERVICE_MAPPING

__all__ = ["SERVICE_MAPPING"]


def describe():
    return [
        {"repo": repo, "source": src, "component": comp, "why": "product ships to own HCP cloud"}
        for repo, (src, comp) in SERVICE_MAPPING.items()
    ]