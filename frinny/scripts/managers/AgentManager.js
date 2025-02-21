/**
 * Manages all interactions with the Frinny AI backend service.
 */

import { logBackendCommunication, logError } from '../utils/logUtils.js';

export class AgentManager {
    constructor() {
        this.isConnected = false;
        this.socket = null;
        this.backendUrl = 'http://localhost:5001'; // TODO: Make this configurable
        this.typingCallback = null; // Callback for typing status
        this.userId = game.user.id; // Store the user's ID
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.pendingRequests = new Map(); // Store both resolve and reject callbacks
        
        // Start monitoring pending requests
        this._startRequestMonitoring();
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
     * Initialize the Socket.IO connection
     * @returns {Promise<void>}
     */
    async connect() {
        try {
            // Load Socket.IO client from CDN if not available
            if (!window.io) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            // Initialize Socket.IO with authentication
            this.socket = io(this.backendUrl, {
                query: { userId: this.userId },
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
            });

            // Connection event handlers
            this.socket.on('connect', () => {
                logBackendCommunication('Socket.IO connection', true, {
                    userId: this.userId
                });
                this.isConnected = true;
                this.reconnectAttempts = 0;
            });

            this.socket.on('disconnect', () => {
                logBackendCommunication('Socket.IO connection', false, {
                    reason: 'disconnected',
                    userId: this.userId
                });
                this.isConnected = false;

                // Reject all pending requests on disconnect
                for (const [requestId, { reject }] of this.pendingRequests) {
                    reject(new Error('Socket.IO disconnected'));
                }
                this.pendingRequests.clear();
            });

            this.socket.on('connect_error', (error) => {
                logError('Socket.IO connection', error, {
                    userId: this.userId,
                    attempt: this.reconnectAttempts + 1,
                    maxAttempts: this.maxReconnectAttempts
                });
                this.reconnectAttempts++;

                // Reject all pending requests on connection error
                for (const [requestId, { reject }] of this.pendingRequests) {
                    reject(new Error('Socket.IO connection error'));
                }
                this.pendingRequests.clear();

                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    logError('Socket.IO connection', new Error('Max reconnection attempts reached'), {
                        userId: this.userId,
                        attempts: this.reconnectAttempts
                    });
                    this.socket.disconnect();
                }
            });

            // Message handlers
            this.socket.on('typing_status', (data) => {
                if (this.typingCallback) {
                    this.typingCallback(data.isTyping);
                }
            });

            // Response handlers for different message types
            this.socket.on('query_response', (data) => {
                this._handleSocketResponse(data.request_id, data);
            });

            this.socket.on('character_creation_response', (data) => {
                this._handleSocketResponse(data.request_id, data);
            });

            this.socket.on('combat_suggestion', (data) => {
                this._handleSocketResponse(data.request_id, data);
            });

            this.socket.on('level_up_response', (data) => {
                this._handleSocketResponse(data.request_id, data);
            });

            // Error handler
            this.socket.on('error', (error) => {
                logError('Socket.IO server', error, {
                    userId: this.userId,
                    requestId: error.request_id
                });

                if (error.request_id) {
                    // Handle error for specific request
                    this._handleSocketError(error.request_id, new Error(error.message));
                } else {
                    // Handle global error - reject all pending requests
                    for (const [requestId, { reject }] of this.pendingRequests) {
                        reject(new Error(`Socket.IO server error: ${error.message}`));
                    }
                    this.pendingRequests.clear();
                }
            });

        } catch (error) {
            logError('Socket.IO initialization', error, {
                userId: this.userId,
                backendUrl: this.backendUrl
            });
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Send a message and wait for response with proper error handling and cleanup
     * @param {string} eventName - The Socket.IO event name to emit
     * @param {Object} data - The data to send
     * @returns {Promise<Object>} The server's response
     * @private
     */
    async _emitAndWait(eventName, data) {
        // Validate connection state
        if (!this.isConnected || !this.socket) {
            throw new Error('Socket.IO not connected');
        }
        console.log('emitting and waiting', eventName, data);
        
        // Create request ID and payload
        const requestId = Date.now().toString();
        const payload = {
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
                    const error = new Error('Socket.IO response timeout');
                    
                    // Log before cleanup to ensure we have the request data
                    logError('Socket.IO timeout', error, {
                        requestId,
                        eventName,
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
                    logError('Socket.IO timeout for missing request', new Error('Request not found'), {
                        requestId,
                        eventName,
                        elapsed: '30s',
                        pendingRequestCount: this.pendingRequests.size,
                        isConnected: this.isConnected
                    });
                }
            }, 30000);

            try {
                // Emit with acknowledgment callback
                this.socket.emit(eventName, payload, (error) => {
                    if (error) {
                        const wrappedError = new Error(`Socket.IO emit error: ${error}`);
                        logError('Socket.IO emit', wrappedError, {
                            requestId,
                            eventName,
                            originalError: error
                        });

                        if (this.pendingRequests.has(requestId)) {
                            const { reject } = this.pendingRequests.get(requestId);
                            reject(wrappedError);
                        }
                    }
                });

                // Log successful emit
                logBackendCommunication('Socket.IO emit', true, {
                    requestId,
                    eventName,
                    userId: this.userId
                });

            } catch (error) {
                // Handle any synchronous errors during emit
                const wrappedError = new Error(`Socket.IO emit failed: ${error.message}`);
                logError('Socket.IO emit', wrappedError, {
                    requestId,
                    eventName,
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
     * Handle Socket.IO response
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
     * Handle Socket.IO error
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
        // Prefer Socket.IO if connected
        if (this.isConnected) {
            return await this._emitAndWait('query', payload);
        }
        // Fallback to HTTP
        return await this._sendRequest('/api/query', payload);
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
            return await this._sendRequest('/api/character/create', context);
        } catch (error) {
            if (error.message === 'Socket.IO not connected') {
                return await this._sendRequest('/api/character/create', context);
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
            return await this._sendRequest('/api/combat/suggest', combatState);
        } catch (error) {
            if (error.message === 'Socket.IO not connected') {
                return await this._sendRequest('/api/combat/suggest', combatState);
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
            return await this._sendRequest('/api/character/level-up', levelUpData);
        } catch (error) {
            if (error.message === 'Socket.IO not connected') {
                return await this._sendRequest('/api/character/level-up', levelUpData);
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
            return await this._sendRequest('/api/combat/start', combatData);
        } catch (error) {
            if (error.message === 'Socket.IO not connected') {
                return await this._sendRequest('/api/combat/start', combatData);
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
        return this._sendRequest('/api/feedback', { messageId, type });
    }

    /**
     * Send an HTTP request to the backend
     * @private
     */
    async _sendRequest(endpoint, data) {
        try {
            const response = await fetch(`${this.backendUrl}${endpoint}`, {
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