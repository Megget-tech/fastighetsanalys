"""
Base agent class with common functionality for all agents.
"""
import os
import json
import time
from typing import Dict, Any, Optional
from pathlib import Path
from datetime import datetime

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class BaseAgent:
    """
    Base class for all analysis agents.
    Provides common functionality for LLM interaction, logging, and error handling.
    """

    def __init__(
        self,
        agent_id: str,
        agent_name: str,
        model: str = "claude-sonnet-4-20250514",
        temperature: float = 0.2,
        max_tokens: int = 4096,
        timeout: int = 120,
    ):
        """
        Initialize the base agent.

        Args:
            agent_id: Unique identifier for the agent
            agent_name: Human-readable name
            model: Claude model to use
            temperature: LLM temperature (0-1)
            max_tokens: Maximum tokens in response
            timeout: Request timeout in seconds (default 120)
        """
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.model_name = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout

        # Initialize LLM
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment variables")

        self.llm = ChatAnthropic(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            max_retries=2,
            api_key=api_key,
        )

        # Load prompt template
        self.prompt_template = self._load_prompt_template()

    def _load_prompt_template(self) -> str:
        """
        Load the prompt template for this agent.

        Returns:
            Prompt template string
        """
        base_path = Path(__file__).parent.parent / "prompts" / "templates"

        # Try different extensions (.txt, .md)
        for ext in [".txt", ".md"]:
            template_path = base_path / f"{self.agent_id}{ext}"
            if template_path.exists():
                with open(template_path, "r", encoding="utf-8") as f:
                    return f.read()

        # Return a basic template if file doesn't exist
        return """Du är {agent_name}.

Din uppgift är att analysera den tillhandahållna datan och producera strukturerade insikter.

INPUT DATA:
{input_data}

Analysera datan noggrant och ge ditt svar i följande format:
{output_format}
"""

    def format_prompt(self, **kwargs) -> str:
        """
        Format the prompt template with provided data.

        Args:
            **kwargs: Data to insert into template

        Returns:
            Formatted prompt
        """
        return self.prompt_template.format(
            agent_name=self.agent_name,
            agent_id=self.agent_id,
            **kwargs
        )

    def invoke_llm(
        self,
        system_prompt: str,
        user_prompt: str,
        return_json: bool = True
    ) -> Dict[str, Any]:
        """
        Invoke the LLM with system and user prompts.

        Args:
            system_prompt: System instructions
            user_prompt: User query/data
            return_json: Whether to parse response as JSON

        Returns:
            LLM response (parsed as JSON if return_json=True)
        """
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]

        try:
            response = self.llm.invoke(messages)
            content = response.content

            if return_json:
                # Try to extract JSON from markdown code blocks if present
                if "```json" in content:
                    start = content.find("```json") + 7
                    end = content.find("```", start)
                    content = content[start:end].strip()
                elif "```" in content:
                    start = content.find("```") + 3
                    end = content.find("```", start)
                    content = content[start:end].strip()

                return json.loads(content)
            else:
                return {"content": content}

        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse LLM response as JSON: {e}\nResponse: {content}")
        except Exception as e:
            raise RuntimeError(f"LLM invocation failed: {e}")

    def create_output(
        self,
        status: str,
        output_data: Dict[str, Any],
        confidence_score: float,
        warnings: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Create standardized agent output.

        Args:
            status: "completed", "failed", "needs_review"
            output_data: Agent-specific output data
            confidence_score: Confidence in results (0-1)
            warnings: List of warnings

        Returns:
            Standardized output dictionary
        """
        return {
            "agent_name": self.agent_name,
            "agent_id": self.agent_id,
            "timestamp": datetime.utcnow().isoformat(),
            "status": status,
            "output": output_data,
            "confidence_score": confidence_score,
            "warnings": warnings or [],
            "model_used": self.model_name,
        }

    def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the agent's analysis.
        This method should be overridden by subclasses.

        Args:
            state: Current workflow state

        Returns:
            Updated state
        """
        raise NotImplementedError("Subclasses must implement execute()")

    def validate_input(self, data: Dict[str, Any], required_fields: list) -> bool:
        """
        Validate that required fields are present in input data.

        Args:
            data: Input data to validate
            required_fields: List of required field names

        Returns:
            True if valid, raises ValueError if not
        """
        missing = [field for field in required_fields if field not in data]
        if missing:
            raise ValueError(f"Missing required fields: {missing}")
        return True

    def log_execution(
        self,
        state: Dict[str, Any],
        status: str,
        execution_time: float,
        message: Optional[str] = None
    ) -> None:
        """
        Log agent execution to state.

        Args:
            state: Current state
            status: Execution status
            execution_time: Time taken in seconds
            message: Optional message
        """
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "agent": self.agent_id,
            "status": status,
            "execution_time_seconds": execution_time,
            "message": message
        }

        if "processing_log" not in state:
            state["processing_log"] = []

        state["processing_log"].append(log_entry)

        if "agent_execution_times" not in state:
            state["agent_execution_times"] = {}

        state["agent_execution_times"][self.agent_id] = execution_time
