import { AgentManager } from './AgentManager.js';
import { logError, logStateChange } from '../utils/logUtils.js';

export class FrinnyChat extends Application {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "frinny-chat",
            template: "modules/frinny/templates/frinny-chat.hbs",
            title: "Frinny",
            width: 800,
            height: 600,
            popOut: true,
            resizable: true,
            minimizable: true,
            classes: ["frinny-window"]
        });
    }

    constructor(options = {}) {
        super(options);
        this.isTyping = false;
        this.messages = [];
        this.agentManager = new AgentManager();
        this.showScrollButton = false;
        
        // Initialize window state
        this.position = game.user.getFlag("frinny", "windowPosition") || {};
        this.isVisible = game.user.getFlag("frinny", "windowVisible") ?? false;
        this.isAvatarCollapsed = game.user.getFlag("frinny", "avatarCollapsed") ?? false;
        
        // Load saved messages
        this._loadMessages();

        // Initialize connection and set up typing callback
        this.agentManager.connect().catch(error => {
            logError('AgentManager connection', error);
        });

        // Set up typing status callback
        this.agentManager.onTypingStatus((isTyping) => {
            this.isTyping = isTyping;
            this.render(false);
        });
    }

    /**
     * Load messages from Foundry flags
     * @private
     */
    async _loadMessages() {
        const savedMessages = await game.user.getFlag("frinny", "messages") || [];
        this.messages = savedMessages;
    }

    /**
     * Save messages to Foundry flags
     * @private
     */
    async _saveMessages() {
        const maxMessages = game.settings.get("frinny", "maxMessages");
        const messagesToSave = this.messages.slice(-maxMessages);
        await game.user.setFlag("frinny", "messages", messagesToSave);
    }

    /**
     * Add a message to the chat history
     * @param {Object} message The message to add
     * @private
     */
    async _addMessage(message) {
        // Check if we're at the bottom before adding the message
        const wasAtBottom = this.element.length ? this._isAtBottom() : true;
        
        this.messages.push(message);
        await this._saveMessages();
        
        // Pass the scroll state to the render method via options
        this.render(false, { scrollToBottom: wasAtBottom });
    }

    /**
     * Update a message in the chat history
     * @param {string} messageId The ID of the message to update
     * @param {Object} updates The updates to apply
     * @private
     */
    async _updateMessage(messageId, updates) {
        // Check if we're at the bottom before updating the message
        const wasAtBottom = this.element.length ? this._isAtBottom() : true;
        
        const message = this.messages.find(m => m.messageId === messageId);
        if (message) {
            Object.assign(message, updates);
            await this._saveMessages();
            this.render(false, { scrollToBottom: wasAtBottom });
        }
    }

    getData() {
        return {
            messages: this.messages,
            isTyping: this.isTyping,
            avatarUrl: "modules/frinny/assets/images/default.png",
            isAvatarCollapsed: this.isAvatarCollapsed,
            showScrollButton: this.showScrollButton
        };
    }

    /**
     * Scrolls the message history to the bottom
     * @private
     */
    _scrollToBottom() {
        const messageHistory = this.element.find('.message-history');
        if (messageHistory.length) {
            const element = messageHistory[0];
            const previousScroll = element.scrollTop;
            
            // Apply scroll immediately
            element.scrollTop = element.scrollHeight;
            console.log('Scrolled to bottom:', { 
                from: previousScroll, 
                to: element.scrollTop, 
                height: element.scrollHeight 
            });
        } else {
            console.log('No message history found to scroll');
        }
    }

    /**
     * Check if we should show the scroll button
     * @private
     */
    _checkScrollPosition() {
        const messageHistory = this.element.find('.message-history')[0];
        if (messageHistory) {
            // Show button if not at the bottom
            const isScrolledUp = !this._isAtBottom();
            const scrollInfo = {
                scrollTop: messageHistory.scrollTop,
                scrollHeight: messageHistory.scrollHeight,
                clientHeight: messageHistory.clientHeight,
                isScrolledUp
            };
            
            if (isScrolledUp !== this.showScrollButton) {
                this.showScrollButton = isScrolledUp;
                this.element.find('.scroll-to-bottom').toggleClass('visible', isScrolledUp);
                console.log('Updated scroll button visibility:', isScrolledUp);
            }
        }
    }

    /**
     * Check if the chat window is scrolled to the bottom (or nearly to the bottom)
     * @private
     * @returns {boolean} True if the window is at the bottom
     */
    _isAtBottom() {
        const messageHistory = this.element.find('.message-history')[0];
        if (!messageHistory) return true;
        
        // Consider "at bottom" if within 20px of the bottom
        return messageHistory.scrollHeight - messageHistory.scrollTop - messageHistory.clientHeight < 20;
    }

    // Override render to handle visibility and scroll positioning
    async render(force = false, options = {}) {
        // Store isInitialOpen flag if window is not currently rendered but will be
        const isInitialOpen = force === true && !this.element.length;
        
        console.log('FrinnyChat render:', { 
            isInitialOpen, 
            force, 
            hasElement: !!this.element.length,
            options
        });
        
        // If window is open, save current scroll position before re-rendering
        if (this.element.length) {
            const messageHistory = this.element.find('.message-history')[0];
            if (messageHistory) {
                const currentScroll = messageHistory.scrollTop;
                // Use setFlag without await to avoid delaying the render
                game.user.setFlag("frinny", "lastScrollPosition", currentScroll);
                console.log('Saved scroll position:', currentScroll);
            }
        }
        
        // Update visibility flag - don't await to avoid delaying the render
        if (force === true || force === false) {
            this.isVisible = force;
            game.user.setFlag("frinny", "windowVisible", this.isVisible);
        }
        
        // Save bottom state before rendering
        const wasAtBottom = this.element.length ? this._isAtBottom() : true;
        
        // Get scroll to bottom preference from options or default to bottom state
        const shouldScrollToBottom = options.scrollToBottom !== undefined ? options.scrollToBottom : wasAtBottom;
        
        console.log('Before render:', { wasAtBottom, shouldScrollToBottom });
        
        // Store these values for use after rendering
        this._pendingRender = {
            isInitialOpen,
            shouldScrollToBottom
        };
        
        // Perform the render
        const result = await super.render(force, options);
        
        // Handle scroll positioning in the activateListeners method
        // which is called after the DOM is fully rendered
        
        return result;
    }

    // Override close to ensure visibility flag is updated
    async close(options = {}) {
        // Save current scroll position before closing
        if (this.element.length) {
            const messageHistory = this.element.find('.message-history')[0];
            if (messageHistory) {
                const currentScroll = messageHistory.scrollTop;
                // Use setFlag without await to avoid delaying the close
                game.user.setFlag("frinny", "lastScrollPosition", currentScroll);
                console.log('Closing window - saved scroll position:', currentScroll);
            }
        }
        
        this.isVisible = false;
        // Use setFlag without await to avoid delaying the close
        game.user.setFlag("frinny", "windowVisible", false);
        return super.close(options);
    }

    // Override setPosition to save position
    setPosition({left, top, width, height, scale} = {}) {
        const position = super.setPosition({left, top, width, height, scale});
        if (position.left && position.top) {
            game.user.setFlag("frinny", "windowPosition", {
                left: position.left,
                top: position.top,
                width: position.width,
                height: position.height
            });
        }
        return position;
    }

    // Toggle window visibility
    async toggleWindow() {
        if (this.rendered) {
            await this.close();
        } else {
            // Restore last position if it exists
            const pos = game.user.getFlag("frinny", "windowPosition");
            // Simply render the window - the render method will handle scroll position
            await this.render(true, { left: pos?.left, top: pos?.top });
        }
    }

    // Override activateListeners to handle scroll positioning after DOM is ready
    activateListeners(html) {
        super.activateListeners(html);

        // Handle scroll position restoration after DOM is fully initialized
        if (this._pendingRender) {
            const { isInitialOpen, shouldScrollToBottom } = this._pendingRender;
            this._pendingRender = null; // Clear it to avoid duplicate processing
            
            const messageHistory = html.find('.message-history')[0];
            
            if (isInitialOpen) {
                const savedPosition = game.user.getFlag("frinny", "lastScrollPosition");
                console.log('Initial open - saved position (in activateListeners):', savedPosition);
                
                if (messageHistory && savedPosition !== null && savedPosition !== undefined) {
                    console.log('Restoring scroll position to:', savedPosition);
                    // Apply the scroll position immediately
                    messageHistory.scrollTop = savedPosition;
                    this._checkScrollPosition();
                } else if (shouldScrollToBottom) {
                    console.log('No saved position, scrolling to bottom');
                    if (messageHistory) {
                        messageHistory.scrollTop = messageHistory.scrollHeight;
                    }
                }
            } else if (shouldScrollToBottom) {
                console.log('Not initial open, scrolling to bottom');
                if (messageHistory) {
                    messageHistory.scrollTop = messageHistory.scrollHeight;
                }
            } else {
                console.log('Not scrolling to bottom');
            }
        }

        // Input handling
        const input = html.find('.chat-input');
        const sendButton = html.find('.send-button');

        // Avatar toggle handling
        const avatarToggle = html.find('.avatar-toggle');
        const avatarPanel = html.find('.avatar-panel');
        
        if (this.isAvatarCollapsed) {
            avatarPanel.addClass('collapsed');
        }

        avatarToggle.on('click', async () => {
            this.isAvatarCollapsed = !this.isAvatarCollapsed;
            avatarPanel.toggleClass('collapsed');
            await game.user.setFlag("frinny", "avatarCollapsed", this.isAvatarCollapsed);
        });

        // Send on enter
        input.on('keypress', (event) => {
            if (event.key === 'Enter') {
                this._handleMessageSend(input.val());
                input.val('');
            }
        });

        // Send on button click
        sendButton.on('click', () => {
            this._handleMessageSend(input.val());
            input.val('');
        });

        // Feedback buttons
        html.find('.thumbs-up').on('click', (event) => {
            const messageId = event.currentTarget.closest('.message').dataset.messageId;
            this._handleFeedback(messageId, 'positive');
        });

        html.find('.thumbs-down').on('click', (event) => {
            const messageId = event.currentTarget.closest('.message').dataset.messageId;
            this._handleFeedback(messageId, 'negative');
        });

        // Add scroll event listener
        const messageHistory = html.find('.message-history');
        messageHistory.on('scroll', () => this._checkScrollPosition());

        // Add click handler for scroll button
        html.find('.scroll-to-bottom').on('click', () => this._scrollToBottom());
    }

    /**
     * Handle sending a message to Frinny from the private chat window
     * @param {string} content - The message content
     * @private
     */
    async _handlePrivateMessage(content) {
        if (!content.trim()) return;
        console.log('_handlePrivateMessage called', { content });

        try {
            // Add user message to private chat
            await this._addMessage({
                type: 'user',
                content: content,
                timestamp: Date.now()
            });

            // Get response from agent
            console.log('Calling handlePrivateQuery');
            const response = await this.agentManager.handlePrivateQuery(game.user.id, content);
            console.log('Got response from handlePrivateQuery', response);
            
            // Add response to private chat
            await this._addMessage(response);
        } catch (error) {
            logError('getting AI response', error);
            const errorMsg = {
                type: 'assistant',
                content: game.i18n.localize('frinny.error.failedResponse'),
                timestamp: Date.now(),
                showFeedback: false
            };
            await this._addMessage(errorMsg);
        }
    }

    /**
     * Handle sending a message to Frinny from the public chat
     * @param {string} content - The message content
     * @private
     */
    async _handlePublicMessage(content) {
        if (!content.trim()) return;

        try {
            // Get response from agent
            const response = await this.agentManager.handlePublicQuery(game.user.id, content);
            
            // Create Foundry chat message for Frinny's response
            await ChatMessage.create({
                content: response.content,
                speaker: { alias: 'Frinny', img: 'modules/frinny/assets/images/default.png' },
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                flavor: game.i18n.localize('frinny.chat.responsePrefix')
            });
        } catch (error) {
            logError('getting AI response', error);
            // Show error in public chat
            await ChatMessage.create({
                content: game.i18n.localize('frinny.error.failedResponse'),
                speaker: { alias: 'Frinny', img: 'modules/frinny/assets/images/default.png' },
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                flavor: game.i18n.localize('frinny.chat.errorPrefix')
            });
        }
    }

    /**
     * Route message handling based on source
     * @param {string} content - The message content
     * @param {boolean} isFromMainChat - Whether the message originated from the main chat
     * @private
     */
    async _handleMessageSend(content, isFromMainChat = false) {
        if (isFromMainChat) {
            await this._handlePublicMessage(content);
        } else {
            await this._handlePrivateMessage(content);
        }
    }

    async _handleFeedback(messageId, type) {
        try {
            await this.agentManager.submitFeedback(messageId, type);
            
            // Update the message with feedback state
            await this._updateMessage(messageId, {
                feedbackSubmitted: true,
                feedbackError: false
            });
        } catch (error) {
            logError('submitting feedback', error);
            
            // Update the message with error state
            await this._updateMessage(messageId, {
                feedbackSubmitted: false,
                feedbackError: true
            });
        }
    }
} 