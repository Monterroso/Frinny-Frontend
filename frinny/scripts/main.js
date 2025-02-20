import { FrinnyChat } from './managers/UIManager.js';

Hooks.once('init', () => {
    console.log('Frinny | Initializing module');
});

Hooks.once('ready', () => {
    console.log('Frinny | Module ready');
    
    // Register module settings
    game.settings.register('frinny', 'showAvatar', {
        name: 'Show Avatar',
        hint: 'Toggle visibility of Frinny\'s avatar',
        scope: 'client',
        config: true,
        type: Boolean,
        default: true,
        onChange: value => {
            if (game.frinny) {
                const avatarPanel = document.querySelector('.frinny-window .avatar-panel');
                if (avatarPanel) {
                    avatarPanel.style.display = value ? 'flex' : 'none';
                }
            }
        }
    });

    game.settings.register('frinny', 'maxMessages', {
        name: game.i18n.localize('frinny.settings.maxMessages.name'),
        hint: game.i18n.localize('frinny.settings.maxMessages.hint'),
        scope: 'client',
        config: true,
        type: Number,
        default: 50,
        range: {
            min: 10,
            max: 200,
            step: 10
        }
    });

    // Initialize the chat window
    game.frinny = new FrinnyChat();
    
    // Restore window state if it was visible
    if (game.user.getFlag("frinny", "windowVisible")) {
        const pos = game.user.getFlag("frinny", "windowPosition");
        game.frinny.render(true, { left: pos?.left, top: pos?.top });
    }
});

// Add the Frinny button to the basic controls
Hooks.on('getSceneControlButtons', (controls) => {
    controls.push({
        name: 'frinny',
        title: 'Frinny Controls',
        layer: 'controls',
        icon: 'fas fa-robot',
        tools: [{
            name: 'chat',
            title: 'Toggle Frinny Chat',
            icon: 'fas fa-comments',
            button: true,
            onClick: () => game.frinny?.toggleWindow()
        }]
    });
});

// Handle chat commands
Hooks.on('chatMessage', (chatLog, message, chatData) => {
    if (message.startsWith('!frinny')) {
        const query = message.slice(7).trim();
        if (game.frinny) {
            game.frinny._handleMessageSend(query);
        }
        return false; // Prevent default chat message
    }
}); 