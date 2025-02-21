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
        this.messages.push(message);
        await this._saveMessages();
        this.render(false);
    }

    /**
     * Update a message in the chat history
     * @param {string} messageId The ID of the message to update
     * @param {Object} updates The updates to apply
     * @private
     */
    async _updateMessage(messageId, updates) {
        const message = this.messages.find(m => m.messageId === messageId);
        if (message) {
            Object.assign(message, updates);
            await this._saveMessages();
            this.render(false);
        }
    }

    getData() {
        return {
            messages: this.messages,
            isTyping: this.isTyping,
            avatarUrl: "modules/frinny/assets/images/default.png",
            isAvatarCollapsed: this.isAvatarCollapsed
        };
    }

    // Override render to handle visibility
    async render(force = false, options = {}) {
        if (force === true || force === false) {
            this.isVisible = force;
            await game.user.setFlag("frinny", "windowVisible", this.isVisible);
        }
        return super.render(force, options);
    }

    // Override close to handle visibility
    async close(options = {}) {
        this.isVisible = false;
        await game.user.setFlag("frinny", "windowVisible", false);
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
            await this.render(true, { left: pos?.left, top: pos?.top });
        }
    }

    activateListeners(html) {
        super.activateListeners(html);

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