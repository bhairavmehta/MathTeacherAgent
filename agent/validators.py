"""
Centralized validation module for tool responses and user inputs.
Provides comprehensive validation, sanitization, and security measures.
"""

import re
import json
import html
import time
from typing import Dict, Any, Optional, Union, List
from dataclasses import dataclass
from enum import Enum


class ValidationError(Exception):
    """Custom exception for validation errors."""
    pass


class SecurityError(Exception):
    """Custom exception for security-related validation failures."""
    pass


class ToolMethod(str, Enum):
    """Valid tool methods."""
    NUMBER_LINE = "number_line"
    PRACTICE = "practice"
    CALCULATOR = "calculator"
    UNKNOWN = "unknown"


@dataclass
class ValidationResult:
    """Result of validation process."""
    is_valid: bool
    data: Optional[Dict[str, Any]] = None
    errors: List[str] = None
    warnings: List[str] = None
    
    def __post_init__(self):
        if self.errors is None:
            self.errors = []
        if self.warnings is None:
            self.warnings = []


@dataclass
class ToolResponse:
    """Validated and sanitized tool response data."""
    method: ToolMethod
    problem: str
    answer: Union[int, float, str]
    success: bool = True
    message: Optional[str] = None
    structured_format: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {
            "tool_used": self.method.value,
            "completed_problem": self.problem,
            "student_answer": self.answer,
            "success": self.success,
            "message": self.message,
            "structured_format": self.structured_format
        }


class RateLimiter:
    """Simple rate limiter for tool calls."""
    
    def __init__(self, max_calls: int = 10, window_seconds: int = 60):
        self.max_calls = max_calls
        self.window_seconds = window_seconds
        self.calls = {}  # session_id -> list of timestamps
    
    def is_allowed(self, session_id: str = "default") -> bool:
        """Check if a call is allowed within rate limits."""
        now = time.time()
        
        # Initialize session if new
        if session_id not in self.calls:
            self.calls[session_id] = []
        
        # Clean old calls outside the window
        self.calls[session_id] = [
            timestamp for timestamp in self.calls[session_id]
            if now - timestamp < self.window_seconds
        ]
        
        # Check if under limit
        if len(self.calls[session_id]) >= self.max_calls:
            return False
        
        # Record this call
        self.calls[session_id].append(now)
        return True


class InputSanitizer:
    """Sanitizes user inputs to prevent security issues."""
    
    # Patterns for potentially malicious content
    SCRIPT_PATTERN = re.compile(r'<script[^>]*>.*?</script>', re.IGNORECASE | re.DOTALL)
    HTML_PATTERN = re.compile(r'<[^>]+>')
    SQL_INJECTION_PATTERNS = [
        re.compile(r'\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b', re.IGNORECASE),
        re.compile(r'[\'";]\s*(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)', re.IGNORECASE),
        re.compile(r'--', re.IGNORECASE),  # SQL comments
        re.compile(r'/\*.*\*/', re.IGNORECASE),  # SQL block comments
    ]
    
    # Mathematical expression validation patterns
    MATH_PATTERN = re.compile(r'^[\d\s+\-*/()×÷.=?]+$')
    
    # Specific math expression patterns
    MATH_EQUATION_PATTERNS = [
        re.compile(r'^\d+\s*[+\-*/×÷]\s*\d+\s*=\s*\?$'),  # "5 + 3 = ?"
        re.compile(r'^\d+\s*[+\-*/×÷]\s*\d+$'),  # "5 + 3"
        re.compile(r'^\d+\s*[+\-*/×÷]\s*\d+\s*=\s*\d+$'),  # "5 + 3 = 8"
        re.compile(r'^\?\s*=\s*\d+\s*[+\-*/×÷]\s*\d+$'),  # "? = 5 + 3"
    ]
    
    @classmethod
    def sanitize_string(cls, text: str, max_length: int = 500) -> str:
        """Sanitize a string input."""
        if not isinstance(text, str):
            raise ValidationError(f"Expected string, got {type(text)}")
        
        # Length check
        if len(text) > max_length:
            raise ValidationError(f"Input too long: {len(text)} > {max_length}")
        
        # Remove scripts
        text = cls.SCRIPT_PATTERN.sub('', text)
        
        # HTML escape
        text = html.escape(text)
        
        # Check for SQL injection patterns
        for pattern in cls.SQL_INJECTION_PATTERNS:
            if pattern.search(text):
                raise SecurityError("Potentially malicious content detected")
        
        return text.strip()
    
    @classmethod
    def sanitize_math_expression(cls, expression: str) -> str:
        """Sanitize mathematical expressions."""
        if not isinstance(expression, str):
            raise ValidationError(f"Expected string expression, got {type(expression)}")
        
        # Length check
        if len(expression) > 100:
            raise ValidationError(f"Expression too long: {len(expression)} > 100")
        
        # Remove scripts (but allow math symbols)
        expression = cls.SCRIPT_PATTERN.sub('', expression)
        
        # HTML escape
        expression = html.escape(expression)
        
        # Unescape for math processing
        expression = html.unescape(expression)
        
        # Normalize mathematical operators
        expression = expression.replace("×", "*").replace("÷", "/")
        
        # First check if it matches any specific math pattern
        is_valid_math = cls.MATH_PATTERN.match(expression)
        is_recognized_math_format = any(pattern.match(expression) for pattern in cls.MATH_EQUATION_PATTERNS)
        
        if not is_valid_math:
            raise ValidationError(f"Invalid mathematical expression: {expression}")
        
        # If it doesn't match recognized math formats, be more careful about security
        if not is_recognized_math_format:
            # Only check for SQL injection if it doesn't look like a math expression
            for pattern in cls.SQL_INJECTION_PATTERNS:
                if pattern.search(expression):
                    raise SecurityError("Potentially malicious content detected")
        
        return expression.strip()
    
    @classmethod
    def sanitize_numeric_answer(cls, answer: Any) -> Union[int, float]:
        """Sanitize and validate numeric answers."""
        if isinstance(answer, (int, float)):
            # Check for reasonable bounds
            if abs(answer) > 1000000:  # 1 million limit
                raise ValidationError(f"Answer out of reasonable bounds: {answer}")
            return answer
        
        if isinstance(answer, str):
            # Remove whitespace and sanitize
            answer = cls.sanitize_string(answer, max_length=20).strip()
            
            try:
                if '.' in answer:
                    result = float(answer)
                else:
                    result = int(answer)
                
                # Check bounds
                if abs(result) > 1000000:
                    raise ValidationError(f"Answer out of reasonable bounds: {result}")
                
                return result
            except ValueError:
                raise ValidationError(f"Cannot convert to number: {answer}")
        
        raise ValidationError(f"Invalid answer type: {type(answer)}")


class ToolResponseValidator:
    """Validates tool responses from frontend components."""
    
    def __init__(self, rate_limiter: Optional[RateLimiter] = None):
        self.rate_limiter = rate_limiter or RateLimiter()
        self.sanitizer = InputSanitizer()
    
    def validate_structured_response(self, content: str, session_id: str = "default") -> ValidationResult:
        """Validate structured tool response format."""
        # Rate limiting check
        if not self.rate_limiter.is_allowed(session_id):
            return ValidationResult(
                is_valid=False,
                errors=["Rate limit exceeded. Too many tool calls."]
            )
        
        try:
            # Check for structured format
            if not content.startswith("TOOL_COMPLETION:"):
                return ValidationResult(
                    is_valid=False,
                    errors=["Invalid response format. Expected TOOL_COMPLETION prefix."]
                )
            
            # Extract structured data
            method_match = re.search(r'\[METHOD:\s*([^\]]+)\]', content)
            answer_match = re.search(r'\[ANSWER:\s*([^\]]+)\]', content)
            problem_match = re.search(r'\[PROBLEM:\s*([^\]]+)\]', content)
            
            if not all([method_match, answer_match, problem_match]):
                return ValidationResult(
                    is_valid=False,
                    errors=["Missing required fields: METHOD, ANSWER, or PROBLEM"]
                )
            
            # Extract and sanitize data
            method_str = self.sanitizer.sanitize_string(method_match.group(1).strip())
            answer_str = answer_match.group(1).strip()
            problem_str = problem_match.group(1).strip()
            
            # Validate method
            try:
                method = ToolMethod(method_str)
            except ValueError:
                method = ToolMethod.UNKNOWN
            
            # Sanitize problem expression
            try:
                problem = self.sanitizer.sanitize_math_expression(problem_str)
            except (ValidationError, SecurityError) as e:
                return ValidationResult(
                    is_valid=False,
                    errors=[f"Invalid problem format: {str(e)}"]
                )
            
            # Sanitize answer
            try:
                answer = self.sanitizer.sanitize_numeric_answer(answer_str)
            except (ValidationError, SecurityError) as e:
                return ValidationResult(
                    is_valid=False,
                    errors=[f"Invalid answer format: {str(e)}"]
                )
            
            # Create validated response
            tool_response = ToolResponse(
                method=method,
                problem=problem,
                answer=answer,
                success=True,
                structured_format=True
            )
            
            return ValidationResult(
                is_valid=True,
                data=tool_response.to_dict(),
                warnings=["Response validated successfully"] if method == ToolMethod.UNKNOWN else []
            )
            
        except Exception as e:
            return ValidationResult(
                is_valid=False,
                errors=[f"Validation error: {str(e)}"]
            )
    
    def validate_legacy_response(self, content: str, session_id: str = "default") -> ValidationResult:
        """Validate legacy response formats for backward compatibility."""
        # Rate limiting check
        if not self.rate_limiter.is_allowed(session_id):
            return ValidationResult(
                is_valid=False,
                errors=["Rate limit exceeded. Too many tool calls."]
            )
        
        try:
            # Sanitize content first
            content = self.sanitizer.sanitize_string(content, max_length=1000)
            
            # Try different legacy patterns
            patterns = [
                (r'solve\s+([^and]+)\s+and got\s+(\d+)', "visual_interaction"),
                (r'calculator to solve\s+([^and]+)\s+and got\s+([^!]+)', "calculator"),
                (r'number line.*?(\d+\s*[+\-*/]\s*\d+).*?(\d+)', "number_line")
            ]
            
            for pattern, method in patterns:
                match = re.search(pattern, content, re.IGNORECASE)
                if match:
                    try:
                        problem = self.sanitizer.sanitize_math_expression(match.group(1).strip())
                        answer = self.sanitizer.sanitize_numeric_answer(match.group(2))
                        
                        tool_response = ToolResponse(
                            method=ToolMethod(method) if method in [m.value for m in ToolMethod] else ToolMethod.UNKNOWN,
                            problem=problem,
                            answer=answer,
                            success=True,
                            structured_format=False
                        )
                        
                        return ValidationResult(
                            is_valid=True,
                            data=tool_response.to_dict(),
                            warnings=["Legacy format detected. Consider upgrading to structured format."]
                        )
                    except (ValidationError, SecurityError) as e:
                        return ValidationResult(
                            is_valid=False,
                            errors=[f"Legacy format validation failed: {str(e)}"]
                        )
            
            return ValidationResult(
                is_valid=False,
                errors=["No recognizable response pattern found"]
            )
            
        except Exception as e:
            return ValidationResult(
                is_valid=False,
                errors=[f"Legacy validation error: {str(e)}"]
            )
    
    def validate_response(self, message: Any, session_id: str = "default") -> ValidationResult:
        """Main validation entry point for any tool response."""
        try:
            # Extract content
            if hasattr(message, 'content') and message.content:
                content = str(message.content).strip()
            else:
                return ValidationResult(
                    is_valid=False,
                    errors=["No content found in message"]
                )
            
            # Try structured format first
            result = self.validate_structured_response(content, session_id)
            if result.is_valid:
                return result
            
            # Fall back to legacy format
            legacy_result = self.validate_legacy_response(content, session_id)
            if legacy_result.is_valid:
                return legacy_result
            
            # Both failed
            return ValidationResult(
                is_valid=False,
                errors=result.errors + legacy_result.errors,
                warnings=["Multiple validation attempts failed"]
            )
            
        except Exception as e:
            return ValidationResult(
                is_valid=False,
                errors=[f"Validation exception: {str(e)}"]
            )


# Global validator instance
_validator = None

def get_validator() -> ToolResponseValidator:
    """Get global validator instance."""
    global _validator
    if _validator is None:
        _validator = ToolResponseValidator()
    return _validator


def validate_tool_response(message: Any, session_id: str = "default") -> ValidationResult:
    """Convenience function for validating tool responses."""
    return get_validator().validate_response(message, session_id)