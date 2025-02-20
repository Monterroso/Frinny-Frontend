/**
 * Manages all interactions with the Frinny AI backend service.
 * Currently uses mock data, but will be replaced with actual API calls.
 */
export class AgentManager {
    constructor() {
        this.mockDelay = 1000; // Simulate network delay
        this.isConnected = false;
        this.socket = null;
        this.messageQueue = new Map(); // Store message promises by ID
    }

    /**
     * Initialize the WebSocket connection
     * @returns {Promise<void>}
     */
    async connect() {
        // Mock successful connection
        await new Promise(resolve => setTimeout(resolve, 500));
        this.isConnected = true;
        console.log('Frinny | Mock WebSocket connected');
    }

    /**
     * Send a message to the AI and get a response
     * @param {string} userId - The user's ID
     * @param {string} content - The message content
     * @returns {Promise<Object>} The AI's response
     */
    async handleUserQuery(userId, content) {
        const messageId = Date.now().toString();
        
        // Mock response data
        const response = {
            type: 'assistant',
            content: this._getMockResponse(content),
            timestamp: Date.now(),
            messageId,
            showFeedback: true
        };

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, this.mockDelay));
        
        return response;
    }

    /**
     * Submit feedback for a message
     * @param {string} messageId - The message ID
     * @param {string} type - The feedback type ('positive' or 'negative')
     */
    async submitFeedback(messageId, type) {
        // Mock feedback submission
        console.log(`Frinny | Mock feedback submitted: ${type} for message ${messageId}`);
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    /**
     * Get character creation suggestions
     * @param {Object} context - The character creation context
     * @returns {Promise<Object>} Suggestions for character creation
     */
    async getCharacterSuggestions(context) {
        // Mock character creation suggestions
        const suggestions = {
            class: ['Fighter', 'Wizard', 'Rogue'],
            background: ['Noble', 'Merchant', 'Scholar'],
            nextSteps: ['Choose your ancestry', 'Select class feats', 'Assign ability scores']
        };

        await new Promise(resolve => setTimeout(resolve, this.mockDelay));
        return suggestions;
    }

    /**
     * Get combat suggestions
     * @param {Object} combatState - The current combat state
     * @returns {Promise<Object>} Combat suggestions
     */
    async getCombatSuggestions(combatState) {
        // Mock combat suggestions
        const suggestions = {
            actions: ['Strike', 'Raise Shield', 'Intimidate'],
            strategy: 'Focus on defensive positioning',
            explanation: 'The enemy has high attack bonus but low AC'
        };

        await new Promise(resolve => setTimeout(resolve, this.mockDelay));
        return suggestions;
    }

    /**
     * Generate a mock response based on the input
     * @private
     */
    _getMockResponse(content) {
        const responses = [
            "I understand you're asking about " + content + ". Let me help with that.",
            "That's an interesting question about " + content + ". Here's what I know.",
            "I can assist you with " + content + ". What specific aspect would you like to know more about?",
            "Let me check the rules regarding " + content + " for you.",
            "I'd be happy to explain more about " + content + "."
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }
} 