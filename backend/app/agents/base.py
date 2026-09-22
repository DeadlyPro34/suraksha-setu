"""
Base agent interface for Suraksha Setu.

Every domain agent inherits from BaseAgent so they remain swappable
when real logic (satellite parsing, LLM calls, routing math) replaces
the current mock implementations.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseAgent(ABC):
    """Abstract base class that all Suraksha Setu agents must implement."""

    name: str = "base"

    @abstractmethod
    def run(self, incident_id: str) -> Dict[str, Any]:
        """Execute the agent's analysis for the given incident.

        Args:
            incident_id: UUID string of the incident to analyse.

        Returns:
            A dict whose shape matches the agent's domain output contract.
        """
        ...

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} name={self.name!r}>"
