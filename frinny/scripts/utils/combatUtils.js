/**
 * Utility functions for combat-related operations
 */

import { canModifyCharacter, gatherCombatCharacterData } from './characterUtils.js';

/**
 * Validates if the current combat turn belongs to the user's character
 * @param {Combat} combat - The current combat instance
 * @returns {boolean} - Whether it's the user's turn
 */
export function isUserCharacterTurn(combat) {
    if (!combat?.started || !combat.current?.tokenId) {
        console.log('Frinny | Combat validation failed: Combat not started or no current token');
        return false;
    }

    const currentCombatant = combat.combatant;
    if (!currentCombatant) {
        console.log('Frinny | Combat validation failed: No current combatant');
        return false;
    }

    const userCharacter = game.user.character;
    return currentCombatant.actor?.id === userCharacter?.id;
}

/**
 * Gathers the current combat state data
 * @param {Combat} combat - The current combat instance
 * @param {Actor} actor - The character actor
 * @returns {Object} - Combat state data
 */
export function gatherCombatStateData(combat, actor) {
    return {
        combatId: combat.id,
        userId: game.user.id,
        round: combat.round,
        turn: combat.turn,
        character: gatherCombatCharacterData(actor),
        // Get all combatants with initiative
        combatants: combat.turns.map(t => ({
            id: t.id,
            name: t.name,
            initiative: t.initiative,
            isAlly: t.actor?.hasPlayerOwner,
            isEnemy: !t.actor?.hasPlayerOwner,
            hp: t.actor?.system.attributes.hp,
            ac: t.actor?.system.attributes.ac
        }))
    };
}

/**
 * Checks if combat is starting (first round, first turn)
 * @param {Combat} combat - The combat instance
 * @param {Object} changed - The changes made to combat
 * @param {Object} options - Update options
 * @returns {boolean} - Whether combat is starting
 */
export function isCombatStarting(combat, changed, options) {
    return changed.round === 1 && 
           changed.turn === 0 && 
           combat.started && 
           !options.direction;
}

/**
 * Gets visible enemies in combat
 * @param {Combat} combat - The combat instance
 * @param {Actor} currentActor - The current actor
 * @returns {Array} - Array of visible enemy data
 */
export function getVisibleEnemies(combat, currentActor) {
    return combat.turns
        .filter(t => !t.actor?.hasPlayerOwner && t.actor?.id !== currentActor.id)
        .map(t => ({
            id: t.id,
            name: t.name,
            hp: t.actor?.system.attributes.hp,
            ac: t.actor?.system.attributes.ac
        }));
}

/**
 * Gets visible allies in combat
 * @param {Combat} combat - The combat instance
 * @param {Actor} currentActor - The current actor
 * @returns {Array} - Array of visible ally data
 */
export function getVisibleAllies(combat, currentActor) {
    return combat.turns
        .filter(t => t.actor?.hasPlayerOwner && t.actor?.id !== currentActor.id)
        .map(t => ({
            id: t.id,
            name: t.name,
            hp: t.actor?.system.attributes.hp
        }));
} 