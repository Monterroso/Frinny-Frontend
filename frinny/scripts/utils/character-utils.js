import SkillProficiencyManager from "./skill-proficiency-manager.js"

/**
 * Utility functions for character management in Foundry VTT
 */
class CharacterUtils {
  /**
   * Get a player's character based on their user ID
   * @param {string} userId - The ID of the user
   * @returns {Actor|null} - The character actor or null if not found
   * @throws {Error} - If the user does not exist
   */
  static getCharacterByUserId(userId) {
    // Find the user in the game.users collection
    const user = game.users.get(userId);
    
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Get the character assigned to this user
    const character = user.character;
    
    if (!character) {
      console.warn(`User ${user.name} (${userId}) has no character assigned`);
      return null;
    }
    
    return character;
  }
  
  /**
   * Get all characters assigned to active players
   * @returns {Array<Actor>} - Array of character actors
   */
  static getAllPlayerCharacters() {
    return game.users
      .filter(user => user.active && !user.isGM && user.character)
      .map(user => user.character);
  }
  
  /**
   * Modify a skill proficiency for a character based on user ID
   * @param {string} userId - The ID of the user
   * @param {string} skillName - The skill name or key
   * @param {string} proficiencyLevel - The proficiency level to set
   * @returns {Promise<boolean>} - Promise resolving when update is complete
   */
  static async modifyUserCharacterSkill(userId, skillName, proficiencyLevel) {
    const character = this.getCharacterByUserId(userId);
    
    if (!character) {
      throw new Error(`No character found for user ${userId}`);
    }
    
    // Use the SkillProficiencyManager to update the skill
    return await SkillProficiencyManager.modifySkillProficiency(
      character.id,
      skillName,
      proficiencyLevel
    );
  }
}

// Make available globally if loaded directly
if (typeof window !== "undefined") {
  window.CharacterUtils = CharacterUtils;
}

export default CharacterUtils; 