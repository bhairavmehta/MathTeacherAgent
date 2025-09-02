/**
 * Frontend validation utilities for tool responses and user inputs
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedData?: any;
}

export class FrontendValidator {
  private static readonly MAX_PROBLEM_LENGTH = 100;
  private static readonly MAX_ANSWER_VALUE = 1000000;
  private static readonly MATH_PATTERN = /^[\d\s+\-*/()×÷.=?]+$/;
  private static readonly MATH_EQUATION_PATTERNS = [
    /^\d+\s*[+\-*/×÷]\s*\d+\s*=\s*\?$/,  // "5 + 3 = ?"
    /^\d+\s*[+\-*/×÷]\s*\d+$/,  // "5 + 3"
    /^\d+\s*[+\-*/×÷]\s*\d+\s*=\s*\d+$/,  // "5 + 3 = 8"
    /^\?\s*=\s*\d+\s*[+\-*/×÷]\s*\d+$/,  // "? = 5 + 3"
  ];
  private static readonly DANGEROUS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /['"`;]\s*(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)/gi,
    /--/g,  // SQL comments
    /\/\*.*\*\//g  // SQL block comments
  ];

  /**
   * Sanitize a string by removing potentially dangerous content
   */
  static sanitizeString(input: string, maxLength: number = 500): string {
    if (typeof input !== 'string') {
      throw new Error(`Expected string, got ${typeof input}`);
    }

    // Length check
    if (input.length > maxLength) {
      throw new Error(`Input too long: ${input.length} > ${maxLength}`);
    }

    // Remove dangerous patterns
    let sanitized = input;
    this.DANGEROUS_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // HTML escape
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    return sanitized.trim();
  }

  /**
   * Validate and sanitize mathematical expressions
   */
  static validateMathExpression(expression: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Length check
      if (expression.length > this.MAX_PROBLEM_LENGTH) {
        errors.push(`Expression too long: ${expression.length} > ${this.MAX_PROBLEM_LENGTH}`);
        return { isValid: false, errors, warnings };
      }

      // Remove script tags only (allow math symbols)
      let cleaned = expression.replace(/<script[^>]*>.*?<\/script>/gi, '');
      
      // Normalize mathematical operators
      cleaned = cleaned.replace(/×/g, '*').replace(/÷/g, '/');

      // Check if it matches basic math pattern
      const isValidMath = this.MATH_PATTERN.test(cleaned);
      const isRecognizedMathFormat = this.MATH_EQUATION_PATTERNS.some(pattern => pattern.test(cleaned));

      if (!isValidMath) {
        errors.push(`Invalid mathematical expression: ${expression}`);
      }

      // Only check for dangerous patterns if it doesn't match recognized math formats
      if (!isRecognizedMathFormat && isValidMath) {
        // Check for dangerous patterns
        for (const pattern of this.DANGEROUS_PATTERNS) {
          if (pattern.test(cleaned)) {
            errors.push(`Potentially dangerous content detected in: ${expression}`);
            break;
          }
        }
      }

      // Check for balanced parentheses
      const openParens = (cleaned.match(/\(/g) || []).length;
      const closeParens = (cleaned.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        errors.push('Unbalanced parentheses in expression');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        sanitizedData: cleaned
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`],
        warnings
      };
    }
  }

  /**
   * Validate numeric answers
   */
  static validateNumericAnswer(answer: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      let numericAnswer: number;

      if (typeof answer === 'number') {
        numericAnswer = answer;
      } else if (typeof answer === 'string') {
        const sanitized = this.sanitizeString(answer, 20);
        numericAnswer = parseFloat(sanitized);
        
        if (isNaN(numericAnswer)) {
          errors.push(`Cannot convert to number: ${answer}`);
          return { isValid: false, errors, warnings };
        }
      } else {
        errors.push(`Invalid answer type: ${typeof answer}`);
        return { isValid: false, errors, warnings };
      }

      // Check reasonable bounds
      if (Math.abs(numericAnswer) > this.MAX_ANSWER_VALUE) {
        errors.push(`Answer out of reasonable bounds: ${numericAnswer}`);
      }

      // Check for infinite or NaN values
      if (!isFinite(numericAnswer)) {
        errors.push(`Invalid numeric value: ${numericAnswer}`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        sanitizedData: numericAnswer
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`],
        warnings
      };
    }
  }

  /**
   * Validate tool response data before sending to backend
   */
  static validateToolResponse(method: string, problem: string, answer: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate method
    const validMethods = ['number_line', 'practice', 'calculator'];
    if (!validMethods.includes(method)) {
      warnings.push(`Unknown method: ${method}`);
    }

    // Validate problem
    const problemValidation = this.validateMathExpression(problem);
    if (!problemValidation.isValid) {
      errors.push(...problemValidation.errors);
    }

    // Validate answer
    const answerValidation = this.validateNumericAnswer(answer);
    if (!answerValidation.isValid) {
      errors.push(...answerValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [...warnings, ...problemValidation.warnings, ...answerValidation.warnings],
      sanitizedData: {
        method,
        problem: problemValidation.sanitizedData || problem,
        answer: answerValidation.sanitizedData || answer
      }
    };
  }

  /**
   * Create a secure response message for the agent
   */
  static createSecureResponseMessage(method: string, problem: string, answer: any): string {
    const validation = this.validateToolResponse(method, problem, answer);
    
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const { method: cleanMethod, problem: cleanProblem, answer: cleanAnswer } = validation.sanitizedData;
    
    return `TOOL_COMPLETION: I used the ${cleanMethod} to solve ${cleanProblem} and got ${cleanAnswer}! [METHOD: ${cleanMethod}] [ANSWER: ${cleanAnswer}] [PROBLEM: ${cleanProblem}]`;
  }
}

/**
 * Rate limiter for frontend tool calls
 */
export class FrontendRateLimiter {
  private static calls: number[] = [];
  private static readonly MAX_CALLS = 5;
  private static readonly WINDOW_MS = 30000; // 30 seconds

  static isAllowed(): boolean {
    const now = Date.now();
    
    // Clean old calls
    this.calls = this.calls.filter(timestamp => now - timestamp < this.WINDOW_MS);
    
    // Check if under limit
    if (this.calls.length >= this.MAX_CALLS) {
      return false;
    }
    
    // Record this call
    this.calls.push(now);
    return true;
  }

  static getRemainingCalls(): number {
    const now = Date.now();
    this.calls = this.calls.filter(timestamp => now - timestamp < this.WINDOW_MS);
    return Math.max(0, this.MAX_CALLS - this.calls.length);
  }
}