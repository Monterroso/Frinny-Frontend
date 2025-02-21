/**
 * Utility functions for consistent logging across the module
 */

const PREFIX = 'Frinny |';

/**
 * Log levels enum
 */
export const LogLevel = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
};

/**
 * Base logging function with consistent formatting
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 */
function baseLog(level, message, context = {}) {
    const logMessage = `${PREFIX} ${message}`;
    
    switch (level) {
        case LogLevel.ERROR:
            console.error(logMessage, context);
            break;
        case LogLevel.WARN:
            console.warn(logMessage, context);
            break;
        case LogLevel.INFO:
            console.log(logMessage, context);
            break;
        case LogLevel.DEBUG:
            console.debug(logMessage, context);
            break;
    }
}

/**
 * Log hook execution
 * @param {string} hookName - Name of the hook
 * @param {Object} context - Hook context data
 */
export function logHookExecution(hookName, context = {}) {
    baseLog(LogLevel.DEBUG, `${hookName} hook triggered:`, context);
}

/**
 * Log hook skip
 * @param {string} hookName - Name of the hook
 * @param {string} reason - Skip reason
 * @param {Object} context - Additional context
 */
export function logHookSkip(hookName, reason, context = {}) {
    baseLog(LogLevel.DEBUG, `${hookName} hook skipped: ${reason}`, context);
}

/**
 * Log permission decision
 * @param {string} action - Action being checked
 * @param {boolean} allowed - Whether permission was granted
 * @param {Object} context - Permission context
 */
export function logPermission(action, allowed, context = {}) {
    const status = allowed ? 'granted' : 'denied';
    baseLog(
        allowed ? LogLevel.DEBUG : LogLevel.WARN,
        `Permission ${status} for ${action}`,
        context
    );
}

/**
 * Log state change
 * @param {string} component - Component being changed
 * @param {string} change - Description of change
 * @param {Object} context - Change context
 */
export function logStateChange(component, change, context = {}) {
    baseLog(LogLevel.INFO, `${component} state change: ${change}`, context);
}

/**
 * Log error with full context
 * @param {string} action - Action that failed
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
export function logError(action, error, context = {}) {
    baseLog(LogLevel.ERROR, `Error during ${action}:`, {
        error: error.message,
        stack: error.stack,
        ...context
    });
}

/**
 * Log backend communication
 * @param {string} action - Communication action
 * @param {boolean} success - Whether communication succeeded
 * @param {Object} context - Communication context
 */
export function logBackendCommunication(action, success, context = {}) {
    const status = success ? 'successful' : 'failed';
    baseLog(
        success ? LogLevel.DEBUG : LogLevel.ERROR,
        `Backend communication ${status} for ${action}`,
        context
    );
}

/**
 * Log performance metric
 * @param {string} action - Action being measured
 * @param {number} duration - Duration in milliseconds
 * @param {Object} context - Additional context
 */
export function logPerformance(action, duration, context = {}) {
    baseLog(LogLevel.DEBUG, `Performance metric for ${action}:`, {
        durationMs: duration,
        ...context
    });
} 