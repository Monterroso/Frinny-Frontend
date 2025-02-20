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
        
        // Initialize window state
        this.position = game.user.getFlag("frinny", "windowPosition") || {};
        this.isVisible = game.user.getFlag("frinny", "windowVisible") ?? false;
        this.isAvatarCollapsed = game.user.getFlag("frinny", "avatarCollapsed") ?? false;
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

    async _handleMessageSend(content) {
        if (!content.trim()) return;

        // Add user message
        this.messages.push({
            type: 'user',
            content: content,
            timestamp: Date.now()
        });

        // Show typing indicator
        this.isTyping = true;
        this.render(false);

        // TODO: Integrate with AgentManager for AI response
        // For now, just simulate a response
        setTimeout(() => {
            this.isTyping = false;
            this.messages.push({
                type: 'assistant',
                content: 'This is a placeholder response.',
                timestamp: Date.now(),
                showFeedback: true,
                messageId: Date.now().toString()
            });
            this.render(false);
        }, 1000);
    }

    _handleFeedback(messageId, type) {
        console.log(`Feedback received: ${type} for message ${messageId}`);
        // TODO: Implement feedback handling
    }
} 