/**
 * A utility for managing skill proficiencies in Pathfinder 2e character sheets
 */
class SkillProficiencyManager {
  /**
   * Proficiency rank values for PF2e
   * @type {Object<string, number>}
   */
  static PROFICIENCY_RANKS = {
    "untrained": 0,
    "trained": 1,
    "expert": 2,
    "master": 3,
    "legendary": 4
  };

  /**
   * Modify a character's skill proficiency level
   * @param {string} characterId - The ID of the character
   * @param {string} skillName - The skill name (e.g., "Acrobatics" or "acr")
   * @param {string} proficiencyLevel - The new proficiency level (untrained, trained, expert, master, legendary)
   * @returns {Promise<boolean>} - A promise that resolves to true when the update is complete
   * @throws {Error} - If the character, skill, or proficiency level is invalid
   */
  static async modifySkillProficiency(characterId, skillName, proficiencyLevel) {
    console.log(`${characterId} : ${skillName} : ${proficiencyLevel}`)
    // Validate inputs
    if (!characterId) throw new Error("Character ID is required");
    if (!skillName) throw new Error("Skill name is required");
    if (!proficiencyLevel) throw new Error("Proficiency level is required");

    // Get the character actor
    const actor = game.actors.get(characterId);
    if (!actor) {
      throw new Error(`Character with ID ${characterId} not found`);
    }

    // Check if the actor is a character
    if (actor.type !== "character") {
      throw new Error("The provided ID does not belong to a character");
    }

    skillName = skillName.toLowerCase();

    // Accessing skills in PF2e
    const skills = actor.system.skills;
    console.log(actor.system.skills["acrobatics"])
    if (!skills[skillName]) {
      throw new Error(`Skill "${skillName}" not found on character sheet, skills are ${JSON.stringify(skills)}`);
    }

    // Map the proficiency level string to the numeric value
    const profLevelNormalized = proficiencyLevel.toLowerCase();
    const proficiencyValue = this.PROFICIENCY_RANKS[profLevelNormalized];
    
    if (proficiencyValue === undefined) {
      throw new Error(`Invalid proficiency level: ${proficiencyLevel}. Must be one of: ${Object.keys(this.PROFICIENCY_RANKS).join(", ")}`);
    }

    // Prepare the update data
    const updateData = {};
    updateData[`system.skills.${skillName}.rank`] = proficiencyValue;

    // Update the actor
    await actor.update(updateData);
    
    // Get display name of the skill for logging
    const skillDisplayName = skills[skillName]?.label || skillName;
    
    console.log(`Updated ${actor.name}'s ${skillDisplayName} proficiency to ${proficiencyLevel}`);
    return true;
  }

  /**
   * Helper method to get all available skills for a character
   * @param {string} characterId - The ID of the character
   * @returns {Object} - Object containing the character's skills
   * @throws {Error} - If the character is not found
   */
  static getCharacterSkills(characterId) {
    const actor = game.actors.get(characterId);
    if (!actor) {
      throw new Error(`Character with ID ${characterId} not found`);
    }
    
    if (actor.type !== "character") {
      throw new Error("The provided ID does not belong to a character");
    }
    
    return actor.system.skills;
  }
}

// Register API globally if this script is loaded by itself
if (typeof window !== "undefined") {
  window.SkillProficiencyManager = SkillProficiencyManager;
}

export default SkillProficiencyManager; 