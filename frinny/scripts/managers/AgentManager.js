/**
 * Manages all interactions with the Frinny AI backend service.
 */
export class AgentManager {
    constructor() {
        this.isConnected = false;
        this.socket = null;
        this.backendUrl = 'http://localhost:5001'; // TODO: Make this configurable
        this.messageCallbacks = new Map(); // Store callbacks for message responses
        this.typingCallback = null; // Callback for typing status
        this.userId = game.user.id; // Store the user's ID
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
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
                console.log('Frinny | Socket.IO connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
            });

            this.socket.on('disconnect', () => {
                console.log('Frinny | Socket.IO disconnected');
                this.isConnected = false;
            });

            this.socket.on('connect_error', (error) => {
                console.error('Frinny | Connection error:', error);
                this.reconnectAttempts++;
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.error('Frinny | Max reconnection attempts reached');
                    this.socket.disconnect();
                }
            });

            // Message handlers
            this.socket.on('typing_status', (data) => {
                if (this.typingCallback) {
                    this.typingCallback(data.isTyping);
                }
            });

            this.socket.on('query_response', (data) => {
                const callback = this.messageCallbacks.get(data.request_id);
                if (callback) {
                    callback(data);
                    this.messageCallbacks.delete(data.request_id);
                }
            });

            this.socket.on('character_creation_response', (data) => {
                const callback = this.messageCallbacks.get(data.request_id);
                if (callback) {
                    callback(data);
                    this.messageCallbacks.delete(data.request_id);
                }
            });

            this.socket.on('combat_suggestion', (data) => {
                const callback = this.messageCallbacks.get(data.request_id);
                if (callback) {
                    callback(data);
                    this.messageCallbacks.delete(data.request_id);
                }
            });

            this.socket.on('level_up_response', (data) => {
                const callback = this.messageCallbacks.get(data.request_id);
                if (callback) {
                    callback(data);
                    this.messageCallbacks.delete(data.request_id);
                }
            });

            this.socket.on('error', (error) => {
                console.error('Frinny | Server error:', error);
                // Reject any pending promises for this request
                if (error.request_id && this.messageCallbacks.has(error.request_id)) {
                    const callback = this.messageCallbacks.get(error.request_id);
                    callback({ error: error.message });
                    this.messageCallbacks.delete(error.request_id);
                }
            });

        } catch (error) {
            console.error('Frinny | Failed to connect:', error);
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Send a message and wait for response
     * @private
     */
    async _emitAndWait(eventName, data) {
        if (!this.isConnected) {
            throw new Error('Socket.IO not connected');
        }

        const requestId = Date.now().toString();
        const payload = {
            request_id: requestId,
            ...data
        };

        return new Promise((resolve, reject) => {
            // Store callback for this request
            this.messageCallbacks.set(requestId, resolve);

            // Set timeout to prevent hanging
            setTimeout(() => {
                this.messageCallbacks.delete(requestId);
                reject(new Error('Socket.IO response timeout'));
            }, 30000);

            // Emit the event
            this.socket.emit(eventName, payload);
        });
    }

    /**
     * Send a message to the AI and get a response
     * @param {string} content - The message content
     * @returns {Promise<Object>} The AI's response
     */
    async handleUserQuery(content) {
        try {
            // Prefer Socket.IO if connected
            if (this.isConnected) {
                return await this._emitAndWait('query', { content });
            }
            // Fallback to HTTP
            return await this._sendRequest('/api/query', { content });
        } catch (error) {
            // If Socket.IO fails, try HTTP
            if (error.message === 'Socket.IO not connected') {
                return await this._sendRequest('/api/query', { content });
            }
            throw error;
        }
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
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Frinny | Request to ${endpoint} failed:`, error);
            throw error;
        }
    }
} 