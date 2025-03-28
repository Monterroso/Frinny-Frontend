/**
 * Manages all interactions with the Frinny AI backend service.
 */

import { logBackendCommunication, logError } from '../utils/logUtils.js';
import SkillProficiencyManager from '../utils/skill-proficiency-manager.js';

export class AgentManager {
    constructor() {
        this.isConnected = false;
        this.socket = null;
        this.connectionPromise = null; // Track current connection attempt
        
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
        // All of our events are set in pendingRequests and then we get the response from them. 
        this.messageHandlers = new Map(); // Store message handlers by type
        
        // Start monitoring pending requests
        this._startRequestMonitoring();
        
        // Set up message handlers
        this._setupMessageHandlers();
        
        // Start periodic reconnection check
        this._startPeriodicReconnection();
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
        
        this.messageHandlers.set('combat_response', (data) => {
            this._handleSocketResponse(data.request_id, data);
        });
        
        this.messageHandlers.set('level_up_response', (data) => {
            this._handleSocketResponse(data.request_id, data);
        });

        // Handle character update events from server
        this.messageHandlers.set('character_update', (data) => {
            // Check if we have skill updates
            if (data.updates?.skills) {
                const actor = game.actors.get(data.actorId);
                if (actor) {
                    // Process each skill update
                    Object.entries(data.updates.skills).forEach(([skillName, proficiency]) => {
                        SkillProficiencyManager.modifySkillProficiency(data.actorId,skillName,proficiency);
                    });
                } else {
                    logError('Character update', new Error('Actor not found'), {
                        actorId: data.actorId,
                        messageId: data.message_id
                    });
                }
            }
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
     * @returns {Promise<void>} Promise that resolves when connection is established
     */
    async connect() {
        // If already connecting, return the existing promise
        if (this.connectionPromise) {
            return this.connectionPromise;
        }
        
        // Create a new connection promise
        this.connectionPromise = new Promise(async (resolve, reject) => {
            try {
                // If we already have a socket, clean it up first
                if (this.socket) {
                    try {
                        // Remove existing event listeners to prevent memory leaks
                        this.socket.removeEventListener('open', this._onOpen);
                        this.socket.removeEventListener('close', this._onClose);
                        this.socket.removeEventListener('error', this._onError);
                        this.socket.removeEventListener('message', this._onMessage);
                        
                        // Close the existing socket
                        this.socket.close(1000, "Reconnecting");
                        this.socket = null;
                    } catch (error) {
                        // Just log the error and continue with reconnection
                        logError('Error cleaning up existing socket', error, {
                            userId: this.userId
                        });
                    }
                }
                
                // Load robust-websocket from local lib directory if not available
                if (!window.RobustWebSocket) {
                    // Use Foundry's built-in path resolution
                    const scriptPath = 'modules/frinny/scripts/lib/robust-websocket.js';
                    
                    // Create script element to load the library
                    await new Promise((resolveScript, rejectScript) => {
                        const script = document.createElement('script');
                        script.src = scriptPath;
                        script.onload = resolveScript;
                        script.onerror = (error) => {
                            console.error('Failed to load robust-websocket from module path:', error);
                            rejectScript(new Error(`Failed to load robust-websocket from ${scriptPath}. Make sure the file exists in your module directory.`));
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
                
                // Set a timeout to reject if connection takes too long
                const connectionTimeoutId = setTimeout(() => {
                    reject(new Error('WebSocket connection timeout after 15 seconds'));
                    this.connectionPromise = null;
                }, 15000); // 15 second timeout for connection
                
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

                // Create enhanced event handlers that also resolve/reject the connection promise
                this._onOpen = (event) => {
                    // Clear the connection timeout
                    clearTimeout(connectionTimeoutId);
                    
                    logBackendCommunication('WebSocket connection', true, {
                        userId: this.userId
                    });
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    
                    // Resolve the connection promise
                    resolve();
                    this.connectionPromise = null;
                };

                this._onClose = (event) => {
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
                    
                    // If connection promise is still pending, reject it
                    if (this.connectionPromise) {
                        clearTimeout(connectionTimeoutId);
                        reject(new Error(`WebSocket connection closed: ${event.reason || 'disconnected'}`));
                        this.connectionPromise = null;
                    }
                };

                this._onError = (error) => {
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
                    
                    // If connection promise is still pending, reject it
                    if (this.connectionPromise) {
                        clearTimeout(connectionTimeoutId);
                        reject(new Error('WebSocket connection error'));
                        this.connectionPromise = null;
                    }
                };

                this._onMessage = (event) => {
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
                };

                // Connection event handlers
                this.socket.addEventListener('open', this._onOpen);
                this.socket.addEventListener('close', this._onClose);
                this.socket.addEventListener('error', this._onError);
                this.socket.addEventListener('message', this._onMessage);

            } catch (error) {
                logError('WebSocket initialization', error, {
                    userId: this.userId,
                    wsUrl: this.wsUrl
                });
                this.isConnected = false;
                reject(error);
                this.connectionPromise = null;
            }
        });
        
        return this.connectionPromise;
    }

    /**
     * Send a message and wait for response with proper error handling and cleanup
     * @param {Object} data - The data to send
     * @returns {Promise<Object>} The server's response
     * @private
     */
    async _emitAndWait(data, requestId) {
        // Validate connection state
        if (!this.isConnected || !this.socket) {
            throw new Error('WebSocket not connected');
        }
        
        console.log('sending message', data.action, data);

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
                        data,
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
                        data,
                        elapsed: '30s',
                        pendingRequestCount: this.pendingRequests.size,
                        isConnected: this.isConnected
                    });
                }
            }, 30000);

            try {
                // Send the message
                this.socket.send(JSON.stringify(data));

                // Log successful send
                logBackendCommunication('WebSocket send', true, {
                    requestId,
                    data,
                    userId: this.userId
                });

            } catch (error) {
                // Handle any synchronous errors during send
                const wrappedError = new Error(`WebSocket send failed: ${error.message}`);
                logError('WebSocket send', wrappedError, {
                    requestId,
                    data,
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
        console.log('handleSocketResponse', requestId, data);
        console.log('pendingRequests', this.pendingRequests);
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

            // Get the actorId from the user's character
            const actorId = game.user.character?.id || null;

            const payload = {
                content,
                actorId,
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
            
            // Get the last 10 general chat messages as raw data
            const conversation_history = recentMessages
                .slice(-10)
                .map(message => {
                    // Return the message in its raw form, but ensure it's serializable
                    // by converting any Roll objects to their serialized form
                    const messageData = message.toObject();
                    
                    // If roll exists but isn't serialized, serialize it
                    if (message.roll && typeof messageData.roll !== 'string') {
                        messageData.roll = message.roll.toJSON();
                    }
                    
                    return messageData;
                });

            // Create current speaker data structure
            const currentSpeaker = {
                userId: game.user.id,
                name: game.user.name,
                actorId: game.user.character?.id || null,
                actorName: game.user.character?.name || null
            };

            const payload = {
                content,
                system_id: game.system.id,
                conversation_history: conversation_history,
                current_speaker: currentSpeaker,
                is_public_chat: true,
                message_count: conversation_history.length
            };

            return this._sendQuery(payload);
        } catch (error) {
            logError('public query handling', error);
            throw error;
        }
    }

    /**
     * Send a message to the backend with appropriate formatting based on message type
     * @param {string} type - Message type ('query' or 'event')
     * @param {Object} data - The data to send
     * @returns {Promise<Object>} The server's response
     * @private
     */
    async _sendMessage(type, data) {
        // If not connected, attempt to reconnect
        if (!this.isConnected || !this.socket) {
            try {
                // Reset reconnection attempts to allow reconnection
                this.reconnectAttempts = 0;
                
                // Log reconnection attempt
                logBackendCommunication('Attempting websocket reconnection on user action', true, {
                    type,
                    userId: this.userId
                });
                
                // Attempt to reconnect - this will wait until connection is established
                await this.connect();
                
            } catch (error) {
                logError('WebSocket reconnection attempt', error, {
                    type,
                    userId: this.userId
                });
                throw new Error(`Failed to send ${type}: WebSocket reconnection failed - ${error.message}`);
            }
        }

        // Generate request ID using timestamp for tracking
        const requestId = `${Date.now().toString()}:${this.userId}`;
        
        // Add userId to the data if needed
        let messageData = {...data, request_id: requestId};
        if (type === 'event') {
            // For events, add userId to the payload object
            messageData = {
                ...messageData,
                userId: this.userId
            };
        } else {
            // For queries and other top-level actions, add userId directly
            messageData.userId = this.userId;
        }
        
        // Create the final payload with action and request_id
        const payload = {
            action: type,
            ...(type === 'event' ? {
                payload: {
                    action: messageData.action,
                    ...messageData
                }
            } : messageData)
        };

        return await this._emitAndWait(payload, requestId);
    }

    /**
     * Send the query to the backend
     * @private
     */
    async _sendQuery(payload) {
        return this._sendMessage('query', payload);
    }

    /**
     * Notify backend about new character creation
     * @param {Object} context - The character creation context
     */
    async notifyCharacterCreation(context) {
        return this._sendMessage('event', { action: 'character_creation_start', ...context });
    }

    /**
     * Notify backend about combat turn
     * @param {Object} combatState - The current combat state
     */
    async notifyCombatTurn(combatState) {
        return this._sendMessage('event', { action: 'combat_turn', ...combatState });
    }

    /**
     * Notify backend about level up
     * @param {Object} levelUpData - The level up context data
     */
    async notifyLevelUp(levelUpData) {
        return this._sendMessage('event', { action: 'level_up', ...levelUpData });
    }

    /**
     * Notify backend about combat start
     * @param {Object} combatData - Initial combat state data
     */
    async notifyCombatStart(combatData) {
        return this._sendMessage('event', { action: 'combat_start', ...combatData });
    }

    /**
     * Submit feedback for a message
     * @param {string} messageId - The message ID
     * @param {string} type - The feedback type ('positive' or 'negative')
     */
    async submitFeedback(messageId, type) {
        return this._sendMessage('event', { action: 'feedback', messageId, type });
    }

    /**
     * Start periodic reconnection attempts when disconnected
     * @private
     */
    _startPeriodicReconnection() {
        // Check every 2 minutes if we need to reconnect
        setInterval(() => {
            // Only attempt reconnection if we're not connected and not already connecting
            if (!this.isConnected && !this.socket && !this.connectionPromise) {
                // Reset reconnection attempts to allow reconnection
                this.reconnectAttempts = 0;
                
                logBackendCommunication('Attempting periodic websocket reconnection', true, {
                    userId: this.userId
                });
                
                // Attempt to reconnect
                this.connect().catch(error => {
                    logError('Periodic websocket reconnection failed', error, {
                        userId: this.userId
                    });
                });
            }
        }, 120000); // 2 minutes
    }
} 