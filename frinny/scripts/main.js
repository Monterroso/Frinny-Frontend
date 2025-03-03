import { FrinnyChat } from './managers/UIManager.js';
import { 
    canModifyCharacter, 
    isNewCharacter, 
    gatherBasicCharacterData, 
    gatherCharacterItems,
    gatherLevelUpData,
    getLevelChange,
    isValidLevelUp,
    hasLevelIncreased
} from './utils/characterUtils.js';
import { logHookExecution, logHookSkip, logError, logStateChange } from './utils/logUtils.js';
import { isUserCharacterTurn, gatherCombatStateData, isCombatStarting, getVisibleEnemies, getVisibleAllies } from './utils/combatUtils.js';

Hooks.once('init', () => {
    logHookExecution('init', { module: 'frinny' });
});

Hooks.once('ready', () => {
    logHookExecution('ready', { module: 'frinny' });
    
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
                logStateChange('Avatar', 'visibility changed', { value });
                if (game.frinny) {
                    const avatarPanel = document.querySelector('.frinny-window .avatar-panel');
                    if (avatarPanel) {
                        avatarPanel.style.display = value ? 'flex' : 'none';
                        logStateChange('Avatar Panel', 'visibility updated', { visible: value });
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
        logStateChange('Settings', 'registered module settings');

        // Initialize the chat window
        game.frinny = new FrinnyChat();
        logStateChange('FrinnyChat', 'instance created');
        
        // Restore window state if it was visible
        if (game.user.getFlag("frinny", "windowVisible")) {
            const pos = game.user.getFlag("frinny", "windowPosition");
            game.frinny.render(true, { left: pos?.left, top: pos?.top });
            logStateChange('Window', 'restored from flags', { position: pos });
        }
    } catch (error) {
        logError('module initialization', error);
    }
});

// Add the Frinny button to the basic controls
Hooks.on('getSceneControlButtons', (controls) => {
    logHookExecution('getSceneControlButtons', { 
        module: 'frinny',
        existingControls: controls.map(c => c.name),
        currentScene: game.scenes?.current?.name || 'none'
    });

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
                logStateChange('Scene Control', 'button clicked', {
                    windowVisible: game.frinny?.rendered || false,
                    userId: game.user.id,
                    scene: game.scenes?.current?.name || 'none'
                });
                game.frinny?.toggleWindow();
            }
        }]
    });

    logStateChange('Scene Controls', 'Frinny controls added', {
        totalControls: controls.length,
        position: controls.length - 1
    });
});

// Handle chat commands
Hooks.on('chatMessage', (chatLog, message, chatData) => {
    logHookExecution('chatMessage', {
        messageLength: message.length,
        userId: game.user.id,
        isFrinnyCommand: message.startsWith('!Frinny'),
        message: message,
        chatLogId: chatLog.id,
        chatDataType: chatData?.type || 'unknown'
    });

    if (message.startsWith('!Frinny')) {
        const query = message.slice(7).trim();
        logStateChange('Chat Command', 'processing', {
            query: query,
            userId: game.user.id,
            timestamp: Date.now(),
            isFrinnyInitialized: !!game.frinny
        });

        if (game.frinny) {
            game.frinny._handleMessageSend(query, true);
            logStateChange('Chat Command', 'handled', {
                success: true,
                command: 'frinny',
                queryLength: query.length
            });
        } else {
            logHookSkip('chatMessage', 'game.frinny not initialized', {
                command: 'frinny',
                userId: game.user.id
            });
        }
        return false; // Prevent default chat message
    }
});

// Handle new character sheets
// Hooks.on('renderActorSheet', async (app, html, data) => {
//     logHookExecution('renderActorSheet', {
//         actor: app.actor.name,
//         actorId: app.actor.id,
//         type: app.actor.type,
//         systemId: game.system.id,
//         userId: game.user.id,
//         isOwner: app.actor.isOwner,
//         isEditable: app.isEditable,
//         windowId: app.id
//     });

//     // Validate character can be modified
//     if (!canModifyCharacter(app.actor)) {
//         logHookSkip('renderActorSheet', 'Character cannot be modified', {
//             actor: app.actor.name,
//             actorId: app.actor.id,
//             type: app.actor.type,
//             userId: game.user.id,
//             permissionLevel: app.actor.getUserLevel(game.user)
//         });
//         return;
//     }

//     // Check if this is a new character
//     if (isNewCharacter(app.actor) && game.frinny) {
//         logHookExecution('characterCreation', {
//             actor: app.actor.name,
//             actorId: app.actor.id,
//             ownership: app.actor.ownership,
//             userId: game.user.id,
//             systemId: game.system.id,
//             isFrinnyReady: !!game.frinny
//         });

//         try {
//             // Gather initial character state using utility functions
//             const characterData = {
//                 ...gatherBasicCharacterData(app.actor),
//                 items: gatherCharacterItems(app.actor, ['class', 'ancestry', 'background'])
//             };

//             logStateChange('Character Creation', 'data gathered', {
//                 actorId: app.actor.id,
//                 dataFields: Object.keys(characterData),
//                 itemCount: characterData.items.length
//             });

//             // Store the context in user flags to track state
//             await game.user.setFlag('frinny', 'characterCreation', {
//                 actorId: app.actor.id,
//                 userId: game.user.id,
//                 step: 'start',
//                 timestamp: Date.now()
//             });

//             logStateChange('Character Creation', 'flags set', {
//                 actorId: app.actor.id,
//                 userId: game.user.id,
//                 step: 'start'
//             });

//             // Notify backend about new character creation and get response
//             const response = await game.frinny.agentManager.notifyCharacterCreation(characterData);

//             // Show Frinny's window
//             await game.frinny.render(true);

//             // Add response to private chat
//             await game.frinny._addMessage({
//                 type: 'assistant',
//                 content: response.message,
//                 timestamp: Date.now(),
//                 showFeedback: true,
//                 messageId: response.messageId
//             });

//             logStateChange('Character Creation', 'process completed', {
//                 actorId: app.actor.id,
//                 success: true
//             });
//         } catch (error) {
//             logError('character creation process', error, {
//                 actor: app.actor.name,
//                 actorId: app.actor.id,
//                 step: game.user.getFlag('frinny', 'characterCreation')?.step
//             });
            
//             // Add error message to private chat
//             await game.frinny._addMessage({
//                 type: 'assistant',
//                 content: game.i18n.localize('frinny.error.failedResponse'),
//                 timestamp: Date.now(),
//                 showFeedback: false
//             });
//         }
//     }
// });

// Handle combat start and turns
// Hooks.on('updateCombat', async (combat, changed, options, userId) => {
//     logHookExecution('updateCombat', {
//         round: combat.round,
//         turn: combat.turn,
//         userId: userId,
//         changed: changed,
//         started: combat.started
//     });

//     // Check if this update is the combat starting
//     if (isCombatStarting(combat, changed, options)) {
//         logHookExecution('combatStart', {
//             round: combat.round,
//             turn: combat.turn
//         });

//         // Get the user's character
//         const userCharacter = game.user.character;
//         if (!userCharacter || !canModifyCharacter(userCharacter)) {
//             logHookSkip('combatStart', 'No valid user character in combat');
//             return;
//         }

//         if (game.frinny) {
//             try {
//                 // Gather combat state data using utility function
//                 const combatData = gatherCombatStateData(combat, userCharacter);
                
//                 // Notify backend about combat start and get response
//                 const response = await game.frinny.agentManager.notifyCombatStart(combatData);

//                 // Show Frinny's window if it's not already visible
//                 if (!game.frinny.rendered) {
//                     await game.frinny.render(true);
//                 }

//                 // Add response to private chat
//                 await game.frinny._addMessage({
//                     type: 'assistant',
//                     content: response.message,
//                     timestamp: Date.now(),
//                     showFeedback: true,
//                     messageId: response.messageId
//                 });
//             } catch (error) {
//                 logError('combat start processing', error);
//                 // Add error message to private chat
//                 await game.frinny._addMessage({
//                     type: 'assistant',
//                     content: game.i18n.localize('frinny.error.failedResponse'),
//                     timestamp: Date.now(),
//                     showFeedback: false
//                 });
//             }
//         } else {
//             logHookSkip('combatStart', 'game.frinny not initialized');
//         }
//         return;
//     }

//     // Handle regular turn updates
//     if (!isUserCharacterTurn(combat)) {
//         logHookSkip('updateCombat', 'Not user\'s character turn');
//         return;
//     }

//     const userCharacter = game.user.character;
//     if (!canModifyCharacter(userCharacter)) {
//         logHookSkip('updateCombat', 'Character cannot be modified');
//         return;
//     }

//     if (game.frinny) {
//         try {
//             // Gather combat state data using utility functions
//             const combatData = {
//                 ...gatherCombatStateData(combat, userCharacter),
//                 enemies: getVisibleEnemies(combat, userCharacter),
//                 allies: getVisibleAllies(combat, userCharacter)
//             };

//             // Notify backend about combat turn and get response
//             const response = await game.frinny.agentManager.notifyCombatTurn(combatData);

//             // Show Frinny's window if it's not already visible
//             if (!game.frinny.rendered) {
//                 await game.frinny.render(true);
//             }

//             // Add response to private chat
//             await game.frinny._addMessage({
//                 type: 'assistant',
//                 content: response.message,
//                 timestamp: Date.now(),
//                 showFeedback: true,
//                 messageId: response.messageId
//             });
//         } catch (error) {
//             logError('combat turn processing', error);
//             // Add error message to private chat
//             await game.frinny._addMessage({
//                 type: 'assistant',
//                 content: game.i18n.localize('frinny.error.failedResponse'),
//                 timestamp: Date.now(),
//                 showFeedback: false
//             });
//         }
//     } else {
//         logHookSkip('updateCombat', 'game.frinny not initialized');
//     }
// });

// Handle level up events
// Hooks.on('updateActor', async (actor, changes, options, userId) => {
//     logHookExecution('updateActor', {
//         actor: actor.name,
//         actorId: actor.id,
//         userId: userId,
//         changes: changes,
//         type: actor.type,
//         systemId: game.system.id
//     });

//     // Validate this is a level up event for our character
//     if (!isValidLevelUp(actor)) {
//         logHookSkip('updateActor', 'Not a valid level up event for user\'s character');
//         return;
//     }

//     // Check if level has changed
//     const levelChange = getLevelChange(changes);
//     if (!levelChange) {
//         logHookSkip('updateActor', 'No level change detected');
//         return;
//     }

//     // Get the previous level from flags or from the current actor state
//     const previousLevel = await actor.getFlag('frinny', 'lastLevel') || actor.system.details.level.value - 1;
//     logStateChange('character', 'Level change detected', {
//         previousLevel,
//         newLevel: levelChange,
//         actor: actor.name
//     });
    
//     // Only proceed if level has increased
//     if (!hasLevelIncreased(levelChange, previousLevel)) {
//         logHookSkip('updateActor', 'Level has not increased');
//         return;
//     }

//     if (game.frinny) {
//         logHookExecution('levelUp', {
//             name: actor.name,
//             previousLevel,
//             newLevel: levelChange
//         });

//         try {
//             // Gather level up data using utility function
//             const levelUpData = gatherLevelUpData(actor, previousLevel, levelChange);

//             // Store the new level in flags
//             await actor.setFlag('frinny', 'lastLevel', levelChange);
//             logStateChange('flags', 'Stored new level');

//             // Notify backend about level up and get response
//             const response = await game.frinny.agentManager.notifyLevelUp(levelUpData);

//             // Show Frinny's window
//             await game.frinny.render(true);

//             // Add response to private chat
//             await game.frinny._addMessage({
//                 type: 'assistant',
//                 content: response.message,
//                 timestamp: Date.now(),
//                 showFeedback: true,
//                 messageId: response.messageId
//             });
//         } catch (error) {
//             logError('level up processing', error);
//             // Add error message to private chat
//             await game.frinny._addMessage({
//                 type: 'assistant',
//                 content: game.i18n.localize('frinny.error.failedResponse'),
//                 timestamp: Date.now(),
//                 showFeedback: false
//             });
//         }
//     } else {
//         logHookSkip('levelUp', 'game.frinny not initialized');
//     }
// }); 