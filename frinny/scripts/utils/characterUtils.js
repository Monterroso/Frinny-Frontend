/**
 * Utility functions for gathering and validating character data
 */

import { logPermission } from './logUtils.js';

/**
 * Validates if a character can be modified by the current user
 * @param {Actor} actor - The character actor to validate
 * @returns {boolean} - Whether the character can be modified
 */
export function canModifyCharacter(actor) {
    if (!actor || actor.type !== 'character' || game.system.id !== 'pf2e') {
        logPermission('modify character', false, {
            reason: 'Invalid actor or system',
            actorType: actor?.type,
            systemId: game.system.id
        });
        return false;
    }

    const userPermissionLevel = actor.getUserLevel(game.user);
    const isGM = game.user.isGM;

    // For non-GMs, require explicit OWNER permission
    if (!isGM && userPermissionLevel !== CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
        logPermission('modify character', false, {
            reason: 'User lacks explicit ownership',
            actorId: actor.id,
            userId: game.user.id,
            permissionLevel: userPermissionLevel,
            requiredLevel: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
        });
        return false;
    }

    // For GMs, ensure this is their designated character
    if (isGM) {
        const designatedCharacter = game.user.character;
        if (!designatedCharacter || designatedCharacter.id !== actor.id) {
            logPermission('modify character', false, {
                reason: 'GM viewing non-designated character',
                actorId: actor.id,
                designatedCharacterId: designatedCharacter?.id
            });
            return false;
        }
    }

    return true;
}

/**
 * Gathers basic character data common across different contexts
 * @param {Actor} actor - The character actor to gather data from
 * @returns {Object} - Basic character data
 */
export function gatherBasicCharacterData(actor) {
    return {
        actorId: actor.id,
        userId: game.user.id,
        name: actor.name,
        // Core attributes and statistics
        attributes: actor.system.attributes,
        abilities: actor.system.abilities,
        saves: actor.system.saves,
        skills: actor.system.skills,
        // Resources and points
        resources: actor.system.resources,
        details: actor.system.details
    };
}

/**
 * Gathers detailed item data for a character
 * @param {Actor} actor - The character actor to gather items from
 * @param {Array<string>} itemTypes - Types of items to gather
 * @returns {Object} - Categorized items by type
 */
export function gatherCharacterItems(actor, itemTypes = ['feat', 'action', 'spell', 'class', 'ancestry', 'background', 'heritage', 'equipment']) {
    return Object.fromEntries(
        itemTypes.map(type => [
            type, 
            actor.items.filter(i => i.type === type)
                .map(i => ({
                    id: i.id,
                    name: i.name,
                    type: i.type,
                    system: i.system
                }))
        ])
    );
}

/**
 * Gathers combat-specific character data
 * @param {Actor} actor - The character actor
 * @returns {Object} - Combat-relevant character data
 */
export function gatherCombatCharacterData(actor) {
    return {
        ...gatherBasicCharacterData(actor),
        hp: actor.system.attributes.hp,
        ac: actor.system.attributes.ac,
        // Additional PF2e specific combat data
        martial: actor.system.martial,
        proficiencies: actor.system.proficiencies,
        traits: actor.system.traits,
        items: gatherCharacterItems(actor, ['action', 'spell', 'equipment'])
    };
}

/**
 * Checks if a character is new (no class, ancestry, or background)
 * @param {Actor} actor - The character actor to check
 * @returns {boolean} - Whether the character is new
 */
export function isNewCharacter(actor) {
    return !actor.items.find(i => 
        i.type === 'class' || 
        i.type === 'ancestry' || 
        i.type === 'background'
    );
}

/**
 * Gathers data for a character level up event
 * @param {Actor} actor - The character actor
 * @param {number} previousLevel - The character's previous level
 * @param {number} newLevel - The character's new level
 * @returns {Object} - Level up relevant character data
 */
export function gatherLevelUpData(actor, previousLevel, newLevel) {
    return {
        actorId: actor.id,
        userId: game.user.id,
        system_id: game.system.id,
        previousLevel,
        newLevel,
        // Send structured character data instead of raw actor
        character: {
            name: actor.name,
            // Class information
            class: actor.items.find(i => i.type === 'class')?.toObject() || null,
            // Skills with their ranks
            skills: Object.entries(actor.system.skills || {}).reduce((acc, [key, skill]) => {
                if (skill.rank) {
                    acc[key] = {
                        name: key,
                        rank: skill.rank
                    };
                }
                return acc;
            }, {}),
            // All feats
            feats: actor.items.filter(i => i.type === 'feat').map(feat => ({
                id: feat.id,
                name: feat.name,
                level: feat.system.level?.value,
                type: feat.system.category,
                traits: feat.system.traits.value,
                // description: feat.system.description.value
            })),
            // Other relevant attributes
            abilities: actor.system.abilities,
            attributes: {
                hp: actor.system.attributes?.hp,
                ac: actor.system.attributes?.ac
            },
            details: {
                level: actor.system.details?.level?.value,
                keyability: actor.system.details?.keyability?.value
            },
            // New additions at this level
            newFeats: actor.items.filter(i => 
                i.type === 'feat' && 
                i.system.level?.taken === newLevel
            ).map(feat => ({
                id: feat.id,
                name: feat.name,
                level: feat.system.level?.value,
                type: feat.system.category,
                traits: feat.system.traits.value
            }))
        }
    };
}

/**
 * Checks if an actor update contains a level change
 * @param {Object} changes - The changes object from updateActor
 * @returns {number|null} - The new level value if changed, null otherwise
 */
export function getLevelChange(changes) {
    return changes.system?.details?.level?.value || null;
}

/**
 * Validates if this is a level up event
 * @param {Actor} actor - The actor being updated
 * @param {Object} changes - The changes object
 * @returns {boolean} - Whether this is a valid level up event
 */
export function isValidLevelUp(actor) {
    return actor.type === 'character' && 
           game.system.id === 'pf2e' && 
           actor.id === game.user.character?.id;
}

/**
 * Checks if the level has increased
 * @param {number} newLevel - The new level value
 * @param {number} previousLevel - The previous level value
 * @returns {boolean} - Whether the level has increased
 */
export function hasLevelIncreased(newLevel, previousLevel) {
    return newLevel > previousLevel;
}

/**
 * Gathers data for a character creation event
 * @param {Actor} actor - The character actor
 * @returns {Object} - Character creation data
 */
export function gatherCharacterCreationData(actor) {
    return {
        actorId: actor.id,
        userId: game.user.id,
        system_id: game.system.id,
        // Send the raw character data
        character: actor.toObject()
    };
} 