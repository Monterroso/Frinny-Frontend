import { FrinnyChat } from './managers/UIManager.js';

Hooks.once('init', () => {
    console.log('Frinny | Initializing module');
});

Hooks.once('ready', () => {
    console.log('Frinny | Module ready, initializing settings and UI');
    
    try {
        // Register module settings
        game.settings.register('frinny', 'showAvatar', {
            name: 'Show Avatar',
            hint: 'Toggle visibility of Frinny\'s avatar',
            scope: 'client',
            config: true,
            type: Boolean,
            default: true,
            onChange: value => {
                console.log('Frinny | Avatar visibility setting changed:', value);
                if (game.frinny) {
                    const avatarPanel = document.querySelector('.frinny-window .avatar-panel');
                    if (avatarPanel) {
                        avatarPanel.style.display = value ? 'flex' : 'none';
                        console.log('Frinny | Updated avatar panel visibility');
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
        console.log('Frinny | Registered module settings');

        // Initialize the chat window
        game.frinny = new FrinnyChat();
        console.log('Frinny | Created FrinnyChat instance');
        
        // Restore window state if it was visible
        if (game.user.getFlag("frinny", "windowVisible")) {
            const pos = game.user.getFlag("frinny", "windowPosition");
            game.frinny.render(true, { left: pos?.left, top: pos?.top });
            console.log('Frinny | Restored window state from flags');
        }
    } catch (error) {
        console.error('Frinny | Error during module initialization:', error);
    }
});

// Add the Frinny button to the basic controls
Hooks.on('getSceneControlButtons', (controls) => {
    console.log('Frinny | Adding scene control button');
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
            onClick: () => {
                console.log('Frinny | Scene control button clicked');
                game.frinny?.toggleWindow();
            }
        }]
    });
});

// Handle chat commands
Hooks.on('chatMessage', (chatLog, message, chatData) => {
    console.log('Frinny | chatMessage hook triggered:', {
        message: message,
        userId: game.user.id
    });

    if (message.startsWith('!frinny')) {
        const query = message.slice(7).trim();
        console.log('Frinny | Processing chat command:', {
            query: query,
            userId: game.user.id
        });

        if (game.frinny) {
            game.frinny._handleMessageSend(query);
        } else {
            console.warn('Frinny | game.frinny not initialized, cannot process chat command');
        }
        return false; // Prevent default chat message
    }
});

// Handle new character sheets
Hooks.on('renderActorSheet', async (app, html, data) => {
    console.log('Frinny | renderActorSheet hook triggered:', {
        actor: app.actor.name,
        actorId: app.actor.id,
        type: app.actor.type,
        systemId: game.system.id
    });

    // Only proceed if it's a PF2E character sheet
    if (!(app.actor.type === 'character' && game.system.id === 'pf2e')) {
        console.log('Frinny | renderActorSheet hook skipped: Not a PF2E character', {
            actorType: app.actor.type,
            systemId: game.system.id
        });
        return;
    }

    // Get the user's permission level for this actor
    const userPermissionLevel = app.actor.getUserLevel(game.user);
    const isGM = game.user.isGM;
    
    console.log('Frinny | Checking character ownership:', {
        actorId: app.actor.id,
        userId: game.user.id,
        isGM: isGM,
        permissionLevel: userPermissionLevel,
        ownership: app.actor.ownership
    });

    // If user is not GM, ensure they have explicit OWNER permission
    if (!isGM && userPermissionLevel !== CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
        console.log('Frinny | renderActorSheet hook skipped: User lacks explicit ownership', {
            actorId: app.actor.id,
            userId: game.user.id,
            permissionLevel: userPermissionLevel,
            requiredLevel: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
        });
        return;
    }

    // For GMs, check if they're the designated owner of this character
    if (isGM) {
        const designatedCharacter = game.user.character;
        if (!designatedCharacter || designatedCharacter.id !== app.actor.id) {
            console.log('Frinny | renderActorSheet hook skipped: GM viewing non-designated character', {
                actorId: app.actor.id,
                designatedCharacterId: designatedCharacter?.id
            });
            return;
        }
    }

    // Check if this is a new character (no class, no ancestry, no background)
    const isNewCharacter = !app.actor.items.find(i => i.type === 'class' || i.type === 'ancestry' || i.type === 'background');
    
    if (isNewCharacter && game.frinny) {
        console.log('Frinny | New character detected, starting character creation:', {
            actor: app.actor.name,
            actorId: app.actor.id,
            ownership: app.actor.ownership
        });

        try {
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
            console.log('Frinny | Stored character creation state in flags');

            // Notify backend about new character creation
            await game.frinny.agentManager.notifyCharacterCreation(characterData);
            console.log('Frinny | Successfully notified backend about character creation');

            // Show Frinny's window
            await game.frinny.render(true);
            console.log('Frinny | Rendered Frinny window');
        } catch (error) {
            console.error('Frinny | Error during character creation process:', error);
        }
    }
});

// Handle combat turns
Hooks.on('updateCombat', async (combat, changed, options, userId) => {
    console.log('Frinny | updateCombat hook triggered:', {
        round: combat.round,
        turn: combat.turn,
        userId: userId
    });

    // Only proceed if it's our turn and we're in combat
    if (!combat.started || !combat.current?.tokenId) {
        console.log('Frinny | updateCombat hook skipped: Combat not started or no current token');
        return;
    }
    
    // Get the current combatant
    const currentCombatant = combat.combatant;
    if (!currentCombatant) {
        console.log('Frinny | updateCombat hook skipped: No current combatant');
        return;
    }

    // Check if it's the player's turn
    const isPlayerTurn = currentCombatant.actor?.hasPlayerOwner;
    const isOurToken = currentCombatant.actor?.id === game.user.character?.id;
    
    if (!isPlayerTurn || !isOurToken) {
        console.log('Frinny | updateCombat hook skipped: Not player\'s turn or not our token', {
            isPlayerTurn: isPlayerTurn,
            isOurToken: isOurToken,
            actorId: currentCombatant.actor?.id,
            userCharacterId: game.user.character?.id
        });
        return;
    }

    if (game.frinny) {
        console.log('Frinny | Processing combat turn for character:', {
            name: currentCombatant.actor.name,
            round: combat.round,
            turn: combat.turn
        });

        try {
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
            console.log('Frinny | Successfully notified backend about combat turn');

            // Show Frinny's window if it's not already visible
            if (!game.frinny.rendered) {
                await game.frinny.render(true);
                console.log('Frinny | Rendered Frinny window');
            }
        } catch (error) {
            console.error('Frinny | Error during combat turn processing:', error);
        }
    } else {
        console.warn('Frinny | game.frinny not initialized, skipping combat turn processing');
    }
});

// Handle level up events
Hooks.on('updateActor', async (actor, changes, options, userId) => {
    console.log('Frinny | updateActor hook triggered:', {
        actor: actor.name,
        actorId: actor.id,
        userId: userId,
        changes: changes,
        type: actor.type,
        systemId: game.system.id
    });

    // Only proceed if it's a PF2E character and it's our character
    if (!(actor.type === 'character' && game.system.id === 'pf2e')) {
        console.log('Frinny | updateActor hook skipped: Not a PF2E character', {
            actorType: actor.type,
            systemId: game.system.id
        });
        return;
    }
    
    if (actor.id !== game.user.character?.id) {
        console.log('Frinny | updateActor hook skipped: Not user\'s character', {
            actorId: actor.id,
            userCharacterId: game.user.character?.id
        });
        return;
    }

    // Check if level has increased
    const levelChange = changes.system?.details?.level?.value;
    if (!levelChange) {
        console.log('Frinny | updateActor hook skipped: No level change detected', {
            changes: changes
        });
        return;
    }

    // Get the previous level from flags or default to current level
    const previousLevel = await actor.getFlag('frinny', 'lastLevel') || levelChange;
    console.log('Frinny | Level change detected:', {
        previousLevel: previousLevel,
        newLevel: levelChange,
        actor: actor.name
    });
    
    // Only proceed if level has increased
    if (levelChange <= previousLevel) {
        console.log('Frinny | updateActor hook skipped: Level has not increased', {
            previousLevel: previousLevel,
            newLevel: levelChange
        });
        return;
    }

    if (game.frinny) {
        console.log('Frinny | Processing level up for character:', {
            name: actor.name,
            previousLevel: previousLevel,
            newLevel: levelChange
        });

        // Gather level up state data
        const levelUpData = {
            actorId: actor.id,
            userId: game.user.id,
            previousLevel: previousLevel,
            newLevel: levelChange,
            character: {
                // Basic information
                name: actor.name,
                level: levelChange,
                // Core attributes and statistics
                attributes: actor.system.attributes,
                abilities: actor.system.abilities,
                saves: actor.system.saves,
                skills: actor.system.skills,
                // Resources and points
                resources: actor.system.resources,
                details: actor.system.details,
                // All items categorized by type
                items: Object.fromEntries(
                    ['feat', 'action', 'spell', 'class', 'ancestry', 'background', 'heritage', 'equipment']
                    .map(type => [type, actor.items.filter(i => i.type === type)
                        .map(i => ({
                            id: i.id,
                            name: i.name,
                            type: i.type,
                            system: i.system
                        }))
                    ])
                ),
                // Additional PF2e specific data
                martial: actor.system.martial,
                proficiencies: actor.system.proficiencies,
                traits: actor.system.traits
            }
        };

        try {
            // Store the new level in flags
            await actor.setFlag('frinny', 'lastLevel', levelChange);
            console.log('Frinny | Stored new level in flags:', levelChange);

            // Notify backend about level up
            await game.frinny.agentManager.notifyLevelUp(levelUpData);
            console.log('Frinny | Successfully notified backend about level up');

            // Show Frinny's window
            await game.frinny.render(true);
            console.log('Frinny | Rendered Frinny window');
        } catch (error) {
            console.error('Frinny | Error during level up processing:', error);
        }
    } else {
        console.warn('Frinny | game.frinny not initialized, skipping level up processing');
    }
}); 