/**
 * Manages all interactions with the Frinny AI backend service.
 */

import { logBackendCommunication, logError } from '../utils/logUtils.js';

export class AgentManager {
    constructor() {
        this.isConnected = false;
        this.socket = null;
        
        // HTTP API endpoint - can be configured for AWS API Gateway
        // AWS API Gateway HTTP URLs typically look like:
        // https://xxxxx.execute-api.region.amazonaws.com/stage
        this.backendUrl = game.settings.get('frinny', 'backendUrl') || 'https://frinny.net';
        
        // WebSocket endpoint - can be configured for AWS API Gateway
        // AWS API Gateway WebSocket URLs typically look like:
        // wss://xxxxx.execute-api.region.amazonaws.com/stage
        this.wsUrl = game.settings.get('frinny', 'wsUrl') || 'wss://frinny.net/ws';
        
        this.typingCallback = null; // Callback for typing status
        this.userId = game.user.id; // Store the user's ID
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.pendingRequests = new Map(); // Store both resolve and reject callbacks
        this.messageHandlers = new Map(); // Store message handlers by type
        
        // Start monitoring pending requests
        this._startRequestMonitoring();
        
        // Set up message handlers
        this._setupMessageHandlers();
    }

    /**
     * Set up message handlers for different message types
     * @private
     */
    _setupMessageHandlers() {
        this.messageHandlers.set('typing_status', (data) => {
            if (this.typingCallback) {
                this.typingCallback(data.isTyping);
            }
        });
        
        this.messageHandlers.set('query_response', (data) => {
            this._handleSocketResponse(data.request_id, data);
        });
        
        this.messageHandlers.set('character_creation_response', (data) => {
            this._handleSocketResponse(data.request_id, data);
        });
        
        this.messageHandlers.set('combat_suggestion', (data) => {
            this._handleSocketResponse(data.request_id, data);
        });
        
        this.messageHandlers.set('level_up_response', (data) => {
            this._handleSocketResponse(data.request_id, data);
        });
        
        this.messageHandlers.set('error', (error) => {
            logError('WebSocket server', error, {
                userId: this.userId,
                requestId: error.request_id
            });

            if (error.request_id) {
                // Handle error for specific request
                this._handleSocketError(error.request_id, new Error(error.message));
            } else {
                // Handle global error - reject all pending requests
                for (const [requestId, { reject }] of this.pendingRequests) {
                    reject(new Error(`WebSocket server error: ${error.message}`));
                }
                this.pendingRequests.clear();
            }
        });
    }

    /**
     * Start monitoring pending requests for potential issues
     * @private
     */
    _startRequestMonitoring() {
        // Check every 10 seconds for stale requests
        setInterval(() => {
            const now = Date.now();
            const staleThreshold = 25000; // Consider requests stale after 25s (before timeout)

            for (const [requestId, request] of this.pendingRequests) {
                const requestTime = parseInt(requestId); // Since we use timestamp as ID
                const elapsed = now - requestTime;

                if (elapsed > staleThreshold) {
                    logError('Stale request detected', new Error('Request approaching timeout'), {
                        requestId,
                        elapsed: `${Math.round(elapsed / 1000)}s`,
                        pendingRequestCount: this.pendingRequests.size,
                        isConnected: this.isConnected
                    });
                }
            }

            // Log general request state if any pending
            if (this.pendingRequests.size > 0) {
                logBackendCommunication('Pending requests status', true, {
                    pendingCount: this.pendingRequests.size,
                    isConnected: this.isConnected,
                    requestIds: Array.from(this.pendingRequests.keys())
                });
            }
        }, 10000);
    }

    /**
     * Set callback for typing status changes
     * @param {Function} callback - Function to call when typing status changes
     */
    onTypingStatus(callback) {
        this.typingCallback = callback;
    }

    /**
     * Initialize the WebSocket connection
     * @returns {Promise<void>}
     */
    async connect() {
        try {
            // Load robust-websocket from local lib directory if not available
            if (!window.RobustWebSocket) {
                // Use Foundry's built-in path resolution
                const scriptPath = 'modules/frinny/scripts/lib/robust-websocket.js';
                
                // Create script element to load the library
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = scriptPath;
                    script.onload = resolve;
                    script.onerror = (error) => {
                        console.error('Failed to load robust-websocket from module path:', error);
                        reject(new Error(`Failed to load robust-websocket from ${scriptPath}. Make sure the file exists in your module directory.`));
                    };
                    document.head.appendChild(script);
                });
                
                // Verify that RobustWebSocket is now available
                if (!window.RobustWebSocket) {
                    throw new Error('RobustWebSocket was not properly loaded. Check the module structure.');
                }
            }

            // Create WebSocket URL with user ID as query parameter
            const wsUrlWithParams = `${this.wsUrl}?userId=${this.userId}`;
            
            // Initialize robust-websocket
            this.socket = new RobustWebSocket(wsUrlWithParams, null, {
                // Configuration options
                timeout: 30000, // 30 seconds
                shouldReconnect: (event, ws) => {
                    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                        return false; // Stop reconnecting after max attempts
                    }
                    
                    this.reconnectAttempts++;
                    
                    // Return delay in ms
                    return Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 5000);
                }
            });

            // Connection event handlers
            this.socket.addEventListener('open', () => {
                logBackendCommunication('WebSocket connection', true, {
                    userId: this.userId
                });
                this.isConnected = true;
                this.reconnectAttempts = 0;
            });

            this.socket.addEventListener('close', (event) => {
                logBackendCommunication('WebSocket connection', false, {
                    reason: event.reason || 'disconnected',
                    code: event.code,
                    userId: this.userId
                });
                this.isConnected = false;

                // Reject all pending requests on disconnect
                for (const [requestId, { reject }] of this.pendingRequests) {
                    reject(new Error('WebSocket disconnected'));
                }
                this.pendingRequests.clear();
            });

            this.socket.addEventListener('error', (error) => {
                logError('WebSocket connection', error, {
                    userId: this.userId,
                    attempt: this.reconnectAttempts + 1,
                    maxAttempts: this.maxReconnectAttempts
                });

                // Reject all pending requests on connection error
                for (const [requestId, { reject }] of this.pendingRequests) {
                    reject(new Error('WebSocket connection error'));
                }
                this.pendingRequests.clear();
            });

            // Message handler
            this.socket.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    // Route message to appropriate handler based on type or action
                    // API Gateway typically uses 'action' field
                    const messageType = data.action;
                    
                    if (messageType && this.messageHandlers.has(messageType)) {
                        this.messageHandlers.get(messageType)(data);
                    } else {
                        logError('WebSocket message', new Error('Unknown message type'), {
                            type: messageType,
                            data: data,
                            event: event
                        });
                    }
                } catch (error) {
                    logError('WebSocket message parsing', error, {
                        data: event.data
                    });
                }
            });

        } catch (error) {
            logError('WebSocket initialization', error, {
                userId: this.userId,
                wsUrl: this.wsUrl
            });
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Send a message and wait for response with proper error handling and cleanup
     * @param {string} type - The message type
     * @param {Object} data - The data to send
     * @returns {Promise<Object>} The server's response
     * @private
     */
    async _emitAndWait(type, data) {
        // Validate connection state
        if (!this.isConnected || !this.socket) {
            throw new Error('WebSocket not connected');
        }
        console.log('sending message', type, data);
        
        // Create request ID and payload
        const requestId = Date.now().toString();
        const payload = {
            action: type, // API Gateway uses 'action' for routing
            type,         // Keep type for backward compatibility
            request_id: requestId,
            ...data
        };

        return new Promise((resolve, reject) => {
            let timeoutId;

            // Function to clean up resources
            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                this.pendingRequests.delete(requestId);
            };

            // Store both callbacks and cleanup function
            this.pendingRequests.set(requestId, {
                resolve: (data) => {
                    cleanup();
                    resolve(data);
                },
                reject: (error) => {
                    cleanup();
                    reject(error);
                },
                cleanup
            });

            // Set timeout
            timeoutId = setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    const { reject, cleanup } = this.pendingRequests.get(requestId);
                    const error = new Error('WebSocket response timeout');
                    
                    // Log before cleanup to ensure we have the request data
                    logError('WebSocket timeout', error, {
                        requestId,
                        type,
                        elapsed: '30s',
                        pendingRequestCount: this.pendingRequests.size,
                        isConnected: this.isConnected
                    });

                    // Cleanup first to ensure we don't have lingering resources
                    cleanup();
                    
                    // Then reject the promise
                    reject(error);
                } else {
                    // Log if somehow the request was already removed
                    logError('WebSocket timeout for missing request', new Error('Request not found'), {
                        requestId,
                        type,
                        elapsed: '30s',
                        pendingRequestCount: this.pendingRequests.size,
                        isConnected: this.isConnected
                    });
                }
            }, 30000);

            try {
                // Send the message
                this.socket.send(JSON.stringify(payload));

                // Log successful send
                logBackendCommunication('WebSocket send', true, {
                    requestId,
                    type,
                    userId: this.userId
                });

            } catch (error) {
                // Handle any synchronous errors during send
                const wrappedError = new Error(`WebSocket send failed: ${error.message}`);
                logError('WebSocket send', wrappedError, {
                    requestId,
                    type,
                    originalError: error
                });

                if (this.pendingRequests.has(requestId)) {
                    const { reject } = this.pendingRequests.get(requestId);
                    reject(wrappedError);
                }
            }
        });
    }

    /**
     * Handle WebSocket response
     * @param {string} requestId - The ID of the request
     * @param {Object} data - The response data
     * @private
     */
    _handleSocketResponse(requestId, data) {
        if (this.pendingRequests.has(requestId)) {
            const { resolve } = this.pendingRequests.get(requestId);
            resolve(data);
        }
    }

    /**
     * Handle WebSocket error
     * @param {string} requestId - The ID of the request
     * @param {Error} error - The error object
     * @private
     */
    _handleSocketError(requestId, error) {
        if (this.pendingRequests.has(requestId)) {
            const { reject } = this.pendingRequests.get(requestId);
            reject(error);
        }
    }

    /**
     * Handle a query from the private chat window
     * @param {string} userId - The user's ID
     * @param {string} content - The message content
     * @returns {Promise<Object>} The AI's response
     */
    async handlePrivateQuery(userId, content) {
        try {
            // Get conversation history from user flags
            const history = await game.users.get(userId)?.getFlag("frinny", "messages") || [];
            const conversationContext = history
                .map(msg => ({
                    role: msg.type === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }))
                .slice(-10); // Get last 10 messages for private chat context

            // Add current message
            conversationContext.push({
                role: 'user',
                content: content
            });

            const payload = {
                content,
                conversation_history: conversationContext,
                is_public_chat: false
            };

            return this._sendQuery(payload);
        } catch (error) {
            logError('private query handling', error);
            throw error;
        }
    }

    /**
     * Handle a query from the public chat
     * @param {string} userId - The user's ID
     * @param {string} content - The message content
     * @returns {Promise<Object>} The AI's response
     */
    async handlePublicQuery(userId, content) {
        try {
            const recentMessages = game.messages.contents;
            
            // Get the last 10 general chat messages for context
            const generalContext = recentMessages
                .slice(-10)
                .map(m => ({
                    role: 'context',
                    speaker: m.speaker.alias || m.speaker.character?.name || 'Unknown',
                    content: m.content,
                    type: m.type
                }));

            // Get the last 5 Frinny-specific interactions
            const frinnyContext = recentMessages
                .filter(m => m.content.startsWith('!frinny') || m.speaker.alias === 'Frinny')
                .slice(-5)
                .map(m => ({
                    role: m.speaker.alias === 'Frinny' ? 'assistant' : 'user',
                    content: m.speaker.alias === 'Frinny' ? m.content : m.content.slice(7).trim() // Remove !frinny prefix
                }));

            const payload = {
                content,
                conversation_history: {
                    general_context: generalContext,
                    frinny_interactions: frinnyContext
                },
                current_speaker: game.user.character?.name || game.user.name,
                is_public_chat: true,
                // Include additional context that might be helpful
                scene_context: {
                    current_scene: game.scenes.current?.name,
                    is_combat_active: game.combat?.started || false,
                    current_round: game.combat?.round || 0
                }
            };

            return this._sendQuery(payload);
        } catch (error) {
            logError('public query handling', error);
            throw error;
        }
    }

    /**
     * Send the query to the backend
     * @private
     */
    async _sendQuery(payload) {
        // Prefer WebSocket if connected
        if (this.isConnected) {
            return await this._emitAndWait('query', payload);
        }
        // Fallback to HTTP
        return await this._sendRequest('query', payload);
    }

    /**
     * Notify backend about new character creation
     * @param {Object} context - The character creation context
     */
    async notifyCharacterCreation(context) {
        try {
            if (this.isConnected) {
                return await this._emitAndWait('character_creation_start', context);
            }
            return await this._sendRequest('character/create', context);
        } catch (error) {
            if (error.message === 'WebSocket not connected') {
                return await this._sendRequest('character/create', context);
            }
            throw error;
        }
    }

    /**
     * Notify backend about combat turn
     * @param {Object} combatState - The current combat state
     */
    async notifyCombatTurn(combatState) {
        try {
            if (this.isConnected) {
                return await this._emitAndWait('combat_turn', combatState);
            }
            return await this._sendRequest('combat/suggest', combatState);
        } catch (error) {
            if (error.message === 'WebSocket not connected') {
                return await this._sendRequest('combat/suggest', combatState);
            }
            throw error;
        }
    }

    /**
     * Notify backend about level up
     * @param {Object} levelUpData - The level up context data
     */
    async notifyLevelUp(levelUpData) {
        try {
            if (this.isConnected) {
                return await this._emitAndWait('level_up', levelUpData);
            }
            return await this._sendRequest('character/level-up', levelUpData);
        } catch (error) {
            if (error.message === 'WebSocket not connected') {
                return await this._sendRequest('character/level-up', levelUpData);
            }
            throw error;
        }
    }

    /**
     * Notify backend about combat start
     * @param {Object} combatData - Initial combat state data
     */
    async notifyCombatStart(combatData) {
        try {
            if (this.isConnected) {
                return await this._emitAndWait('combat_start', combatData);
            }
            return await this._sendRequest('combat/start', combatData);
        } catch (error) {
            if (error.message === 'WebSocket not connected') {
                return await this._sendRequest('combat/start', combatData);
            }
            throw error;
        }
    }

    /**
     * Submit feedback for a message
     * @param {string} messageId - The message ID
     * @param {string} type - The feedback type ('positive' or 'negative')
     */
    async submitFeedback(messageId, type) {
        // Use HTTP for feedback as it's not time-critical
        return this._sendRequest('feedback', { messageId, type });
    }

    /**
     * Send an HTTP request to the backend
     * @private
     */
    async _sendRequest(endpoint, data) {
        try {
            // Ensure endpoint starts with a slash if not already
            const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            
            // For API Gateway, we might need to use the full URL without additional path
            // If backendUrl already includes the endpoint (like API Gateway stage paths)
            const url = this.backendUrl.includes('/api') ? 
                this.backendUrl : 
                `${this.backendUrl}${formattedEndpoint}`;
                
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Id': this.userId
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            logError('HTTP request', error, {
                endpoint,
                userId: this.userId,
                ...data
            });
            throw error;
        }
    }
} 