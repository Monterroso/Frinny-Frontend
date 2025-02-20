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

// Handle new character sheets
Hooks.on('renderActorSheet', async (app, html, data) => {
    // Only proceed if it's a PF2E character sheet
    if (!(app.actor.type === 'character' && game.system.id === 'pf2e')) return;

    // Check if this is a new character (no class, no ancestry, no background)
    const isNewCharacter = !app.actor.items.find(i => i.type === 'class' || i.type === 'ancestry' || i.type === 'background');
    
    if (isNewCharacter && game.frinny) {
        // Gather initial character state
        const characterData = {
            actorId: app.actor.id,
            userId: game.user.id,
            name: app.actor.name,
            abilities: app.actor.system.abilities,
            skills: app.actor.system.skills,
            items: app.actor.items.map(i => ({
                id: i.id,
                name: i.name,
                type: i.type
            }))
        };

        // Store the context in user flags to track state
        await game.user.setFlag('frinny', 'characterCreation', {
            actorId: app.actor.id,
            userId: game.user.id,
            step: 'start',
            timestamp: Date.now()
        });

        // Notify backend about new character creation
        await game.frinny.agentManager.notifyCharacterCreation(characterData);

        // Show Frinny's window
        await game.frinny.render(true);
    }
});

// Handle combat turns
Hooks.on('updateCombat', async (combat, changed, options, userId) => {
    // Only proceed if it's our turn and we're in combat
    if (!combat.started || !combat.current?.tokenId) return;
    
    // Get the current combatant
    const currentCombatant = combat.combatant;
    if (!currentCombatant) return;

    // Check if it's the player's turn
    const isPlayerTurn = currentCombatant.actor?.hasPlayerOwner;
    const isOurToken = currentCombatant.actor?.id === game.user.character?.id;
    
    if (isPlayerTurn && isOurToken && game.frinny) {
        // Gather combat state data
        const combatData = {
            actorId: currentCombatant.actor.id,
            userId: game.user.id,
            round: combat.round,
            turn: combat.turn,
            // Current character state
            character: {
                name: currentCombatant.actor.name,
                hp: currentCombatant.actor.system.attributes.hp,
                ac: currentCombatant.actor.system.attributes.ac,
                abilities: currentCombatant.actor.system.abilities,
                skills: currentCombatant.actor.system.skills,
                items: currentCombatant.actor.items.map(i => ({
                    id: i.id,
                    name: i.name,
                    type: i.type
                }))
            },
            // Get visible enemies
            enemies: combat.turns
                .filter(t => !t.actor?.hasPlayerOwner && t.actor?.id !== currentCombatant.actor.id)
                .map(t => ({
                    id: t.id,
                    name: t.name,
                    hp: t.actor?.system.attributes.hp,
                    ac: t.actor?.system.attributes.ac,
                    // Add other relevant enemy data
                })),
            // Get visible allies
            allies: combat.turns
                .filter(t => t.actor?.hasPlayerOwner && t.actor?.id !== currentCombatant.actor.id)
                .map(t => ({
                    id: t.id,
                    name: t.name,
                    hp: t.actor?.system.attributes.hp,
                    // Add other relevant ally data
                }))
        };

        // Notify backend about combat turn
        await game.frinny.agentManager.notifyCombatTurn(combatData);

        // Show Frinny's window if it's not already visible
        if (!game.frinny.rendered) {
            await game.frinny.render(true);
        }
    }
}); 