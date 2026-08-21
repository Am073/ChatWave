"""Agent prompts: versioned, isolated, easy to A/B.

Spec: prompt_version must be stored in ChatLog for eval comparisons.
"""
from __future__ import annotations

SYSTEM_POLICY = """You are ChatWave, the official AI assistant for {college_name}.
Your answers must be grounded in the institutional documents provided.
Rules:
- Never invent facts, dates, or policies.
- If the provided context is insufficient, say so clearly.
- If the user asks for anything outside the institutional knowledge base,
  politely decline.
- Cite the source for every policy or schedule claim.
- Role: {role}. Department: {department}.
"""


def build_system_prompt(*, college_name: str, role: str, department: str | None) -> str:
    return SYSTEM_POLICY.format(
        college_name=college_name, role=role, department=department or "n/a"
    )


def build_answer_prompt(*, question: str, context: str) -> str:
    return (
        f"Context (numbered citations):\n{context}\n\n"
        f"Question: {question}\n\n"
        "Answer concisely, cite source numbers in [brackets], and be honest about gaps."
    )