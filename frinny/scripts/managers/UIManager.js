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
        
        // Initialize avatar state management
        this.avatarState = 'default'; // Possible states: default, thinking, happy, confused
        this.avatarStateTimer = null;
        
        // Load saved messages
        this._loadMessages();

        // Initialize connection and set up typing callback
        this.agentManager.connect().catch(error => {
            logError('AgentManager connection', error);
        });

        // Set up typing status callback
        this.agentManager.onTypingStatus((isTyping) => {
            this.isTyping = isTyping;
            if (isTyping) {
                this._setAvatarState('thinking');
            } else {
                // When typing stops, we'll use the response handler to set the appropriate state
                // Default back to default state after a delay only if no other state takes over
                setTimeout(() => {
                    if (this.avatarState === 'thinking') {
                        this._setAvatarState('default');
                    }
                }, 1000);
            }
            this.render(false);
        });
        
        // Monitor pending requests to update avatar state
        this._startAvatarStateMonitoring();
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
        // Get the appropriate avatar URL based on the current state
        let avatarUrl;
        switch (this.avatarState) {
            case 'thinking':
                avatarUrl = "modules/frinny/assets/images/thinking.webp";
                break;
            case 'happy':
                avatarUrl = "modules/frinny/assets/images/happy.webp";
                break;
            case 'confused':
                avatarUrl = "modules/frinny/assets/images/confused.webp";
                break;
            default:
                avatarUrl = "modules/frinny/assets/images/default.webp";
        }
        
        return {
            messages: this.messages,
            isTyping: this.isTyping,
            avatarUrl: avatarUrl,
            isAvatarCollapsed: this.isAvatarCollapsed,
            showScrollButton: this.showScrollButton
        };
    }

    /**
     * Scrolls the message history to the bottom
     * @private
     */
    _scrollToBottom() {
        const messageHistory = this.element.find('.frinny_message-history');
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
        const messageHistory = this.element.find('.frinny_message-history')[0];
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
        const messageHistory = this.element.find('.frinny_message-history')[0];
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
            const messageHistory = this.element.find('.frinny_message-history')[0];
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
            const messageHistory = this.element.find('.frinny_message-history')[0];
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
            
            const messageHistory = html.find('.frinny_message-history')[0];
            
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

        // Initialize avatar images if this is the first render
        const avatarContainer = html.find('.avatar-container');
        if (avatarContainer.length) {
            const activeImg = avatarContainer.find('.frinny-avatar.active');
            const inactiveImg = avatarContainer.find('.frinny-avatar.inactive');
            
            // Ensure both images have the correct initial source
            let avatarUrl;
            switch (this.avatarState) {
                case 'thinking':
                    avatarUrl = "modules/frinny/assets/images/thinking.webp";
                    break;
                case 'happy':
                    avatarUrl = "modules/frinny/assets/images/happy.webp";
                    break;
                case 'confused':
                    avatarUrl = "modules/frinny/assets/images/confused.webp";
                    break;
                default:
                    avatarUrl = "modules/frinny/assets/images/default.webp";
            }
            
            activeImg.attr('src', avatarUrl);
            inactiveImg.attr('src', avatarUrl);
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
            const messageId = event.currentTarget.closest('.frinny_message').dataset.messageId;
            this._handleFeedback(messageId, 'positive');
        });

        html.find('.thumbs-down').on('click', (event) => {
            const messageId = event.currentTarget.closest('.frinny_message').dataset.messageId;
            this._handleFeedback(messageId, 'negative');
        });

        // Add scroll event listener
        const messageHistory = html.find('.frinny_message-history');
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
            
            // Set avatar to happy state briefly to acknowledge successful response
            this._setAvatarState('happy', 2000); // Show happy for 2 seconds
            
            // Add response to private chat
            await this._addMessage(response);
        } catch (error) {
            logError('getting AI response', error);
            
            // Set avatar to confused state to indicate an error
            this._setAvatarState('confused', 2000); // Show confused for 2 seconds
            
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
            
            // Set avatar to happy state briefly to acknowledge successful response
            this._setAvatarState('happy', 2000); // Show happy for 2 seconds
            
            // Create Foundry chat message for Frinny's response
            await ChatMessage.create({
                content: response.content,
                speaker: { 
                    alias: 'Frinny', 
                    img: `modules/frinny/assets/images/happy.webp` 
                },
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                flavor: game.i18n.localize('frinny.chat.responsePrefix')
            });
        } catch (error) {
            logError('getting AI response', error);
            
            // Set avatar to confused state to indicate an error
            this._setAvatarState('confused', 2000); // Show confused for 2 seconds
            
            // Show error in public chat
            await ChatMessage.create({
                content: game.i18n.localize('frinny.error.failedResponse'),
                speaker: { 
                    alias: 'Frinny', 
                    img: `modules/frinny/assets/images/confused.webp` 
                },
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

    /**
     * Sets the avatar state and handles temporary states
     * @param {string} state - The state to set ('default', 'thinking', 'happy', 'confused')
     * @param {number} duration - Duration in ms for temporary states (happy, confused)
     * @private
     */
    _setAvatarState(state, duration = 0) {
        // Clear any existing timer
        if (this.avatarStateTimer) {
            clearTimeout(this.avatarStateTimer);
            this.avatarStateTimer = null;
        }
        
        // Set the new state
        const previousState = this.avatarState;
        this.avatarState = state;
        logStateChange('Avatar state', { from: previousState, to: state });
        
        // Update the avatar with cross-fade if the element exists
        if (this.element.length) {
            this._updateAvatarWithCrossFade(state);
        } else {
            // If element doesn't exist yet, just render
            this.render(false);
        }
        
        // If duration is provided, schedule reverting to default
        if (duration > 0) {
            this.avatarStateTimer = setTimeout(() => {
                this.avatarState = 'default';
                if (this.element.length) {
                    this._updateAvatarWithCrossFade('default');
                } else {
                    this.render(false);
                }
                this.avatarStateTimer = null;
            }, duration);
        }
    }
    
    /**
     * Updates the avatar with a cross-fade effect
     * @param {string} state - The new avatar state
     * @private
     */
    _updateAvatarWithCrossFade(state) {
        // Get the avatar container
        const avatarContainer = this.element.find('.avatar-container');
        if (!avatarContainer.length) return;
        
        // Get the active and inactive images
        const activeImg = avatarContainer.find('.frinny-avatar.active');
        const inactiveImg = avatarContainer.find('.frinny-avatar.inactive');
        
        if (!activeImg.length || !inactiveImg.length) return;
        
        // Get the URL for the new state
        let newAvatarUrl;
        switch (state) {
            case 'thinking':
                newAvatarUrl = "modules/frinny/assets/images/thinking.webp";
                break;
            case 'happy':
                newAvatarUrl = "modules/frinny/assets/images/happy.webp";
                break;
            case 'confused':
                newAvatarUrl = "modules/frinny/assets/images/confused.webp";
                break;
            default:
                newAvatarUrl = "modules/frinny/assets/images/default.webp";
        }
        
        // Set the new image source on the inactive image
        inactiveImg.attr('src', newAvatarUrl);
        
        // After a brief delay to ensure the image is loaded, swap the classes
        setTimeout(() => {
            activeImg.removeClass('active').addClass('inactive');
            inactiveImg.removeClass('inactive').addClass('active');
        }, 50);
    }
    
    /**
     * Start monitoring agent manager's pending requests to update avatar state
     * @private
     */
    _startAvatarStateMonitoring() {
        // Check every second for pending requests
        setInterval(() => {
            const hasPendingRequests = this.agentManager.pendingRequests.size > 0;
            
            // If there are pending requests and we're not already in thinking state, set to thinking
            if (hasPendingRequests && this.avatarState !== 'thinking') {
                this._setAvatarState('thinking');
            } 
            // If no pending requests and still in thinking state, return to default
            else if (!hasPendingRequests && this.avatarState === 'thinking' && !this.isTyping) {
                this._setAvatarState('default');
            }
        }, 1000);
    }
} 