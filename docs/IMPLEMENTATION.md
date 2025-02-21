# Frinny - AI Assistant Module Implementation

## Overview
Frinny is a Foundry VTT module that provides an AI assistant interface specifically designed for Pathfinder 2E. The module creates a floating, persistent chat window that allows players and GMs to interact with an AI assistant for character creation, leveling, and combat assistance.

## File Structure
```
frinny/
├── scripts/
│   ├── managers/
│   │   ├── UIManager.js     # Core UI handling
│   │   └── AgentManager.js  # AI interaction handling
│   ├── utils/
│   │   ├── characterUtils.js
│   │   ├── combatUtils.js
│   │   └── logUtils.js
│   └── main.js             # Module entry point
├── styles/
│   └── frinny-chat.css     # UI styling
├── templates/
│   └── frinny-chat.hbs     # Chat interface template
├── languages/
│   └── en.json             # English localization
├── assets/
│   └── images/
│       └── default.png     # Default Frinny avatar
└── module.json             # Module manifest
```

## Core Components

### 1. UIManager.js (FrinnyChat Class)
The central UI component that manages the chat interface.

#### Key Features:
- Extends Foundry's `Application` class
- Manages window state (position, visibility)
- Handles user input and message display
- Provides feedback system for responses
- Controls avatar panel visibility with persistent state
- Integrates with AgentManager for AI interactions

#### Important Methods:
```javascript
constructor(options = {})
- Initializes chat window state
- Sets up message history
- Loads saved position and visibility
- Loads avatar panel state
- Creates AgentManager instance
- Establishes backend connection

getData()
- Provides template data
- Includes messages, typing state
- Includes avatar visibility state

async render(force = false, options = {})
- Handles window visibility
- Persists visibility state
- Renders chat interface

async close(options = {})
- Handles window closing
- Saves window state

setPosition({left, top, width, height, scale} = {})
- Manages window positioning
- Saves position to user flags

async toggleWindow()
- Toggles window visibility
- Restores previous position

activateListeners(html)
- Sets up message input handlers
- Manages avatar panel toggle
- Handles feedback buttons
- Manages message submission

async _handleMessageSend(content)
- Processes user messages
- Shows typing indicator
- Triggers AI response via AgentManager
- Handles errors gracefully
- Updates chat interface

async _handleFeedback(messageId, type)
- Submits message feedback
- Updates feedback UI state
- Handles submission errors
```

### 2. AgentManager.js
Handles all interactions with the AI backend service.

#### Key Features:
- Manages WebSocket connections
- Handles message processing
- Provides feedback submission
- Supports character creation
- Offers combat suggestions

#### Important Methods:
```javascript
async connect()
- Establishes WebSocket connection
- Handles connection state

async handleUserQuery(userId, content)
- Processes user messages
- Returns AI responses
- Manages message IDs

async submitFeedback(messageId, type)
- Handles feedback submission
- Validates feedback types

async getCharacterSuggestions(context)
- Provides character creation help
- Returns structured suggestions

async getCombatSuggestions(combatState)
- Offers combat tactical advice
- Returns action suggestions
```

### 3. main.js
Module initialization and Foundry VTT integration.

#### Key Features:
- Registers module hooks
- Sets up module settings
- Initializes chat interface
- Adds UI controls
- Handles chat commands

#### Important Hooks:
```javascript
Hooks.once('init')
- Module initialization
- Basic setup

Hooks.once('ready')
- Registers settings
- Creates FrinnyChat instance
- Restores window state

Hooks.on('getSceneControlButtons')
- Adds Frinny button to scene controls
- Provides window toggle functionality

Hooks.on('chatMessage')
- Handles !frinny chat commands
- Routes messages to chat interface
```

### 4. frinny-chat.hbs
Handlebars template for the chat interface.

#### Components:
- Collapsible avatar panel with Frinny's image
- Toggle button for avatar panel visibility
- Message history display
- Typing indicator
- Message input area
- Feedback buttons with states (unsubmitted/submitted/error)

### 5. frinny-chat.css
Styling for the chat interface.

#### Key Styles:
- Responsive layout
- Message bubbles
- Typing animation
- Feedback button styling and states
- Window positioning
- Animated avatar panel transitions
- Collapsible panel animations
- Feedback confirmation styles

### 6. en.json
Localization file for UI text.

#### Contains:
- Setting names and descriptions
- UI placeholder text
- Status messages
- Button labels
- Feedback messages
- Error messages

### 2. Utility Functions
The module now includes a comprehensive set of utility functions organized by domain:

#### characterUtils.js
Handles all character-related operations and data gathering:

```javascript
// Character Validation
canModifyCharacter(actor)      // Validates if character can be modified
isNewCharacter(actor)          // Checks if character is new
isValidLevelUp(actor)         // Validates level up event
hasLevelIncreased(newLevel, previousLevel)  // Checks level increase

// Data Gathering
gatherBasicCharacterData(actor)    // Gets common character data
gatherCharacterItems(actor, itemTypes)  // Gets categorized item data
gatherCombatCharacterData(actor)   // Gets combat-specific data
gatherLevelUpData(actor, previousLevel, newLevel)  // Gets level up data
getLevelChange(changes)       // Extracts level change from update
```

#### combatUtils.js
Manages combat-related functionality:

```javascript
isUserCharacterTurn(combat)    // Validates user's turn
isCombatStarting(combat, changed, options)  // Checks combat start
gatherCombatStateData(combat, actor)  // Gets combat state
getVisibleEnemies(combat, currentActor)  // Gets enemy data
getVisibleAllies(combat, currentActor)   // Gets ally data
```

#### logUtils.js
Provides consistent logging across the module:

```javascript
// Log Level Enum
LogLevel = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
}

// Core Logging Functions
baseLog(level, message, context)  // Base logging with consistent formatting
logHookExecution(hookName, context)  // Logs hook triggers with context
logHookSkip(hookName, reason, context)  // Logs skipped hook operations
logError(action, error, context)  // Logs errors with full stack traces
logStateChange(component, change, context)  // Logs UI and game state changes
logPermission(action, allowed, context)  // Logs permission decisions
logBackendCommunication(action, success, context)  // Logs API/Socket.IO communication
logPerformance(action, duration, context)  // Logs performance metrics
```

Usage patterns:
- Hook Execution: `logHookExecution('renderActorSheet', { actor, type, systemId })`
- Permission Checks: `logPermission('modify character', false, { reason, actorType })`
- State Changes: `logStateChange('Combat', 'validation failed', { reason })`
- Backend Communication: `logBackendCommunication('Socket.IO connection', true, { userId })`
- Error Handling: `logError('Socket.IO initialization', error, { userId, backendUrl })`

Benefits:
- Consistent "Frinny |" prefix across all logs
- Structured context objects for better debugging
- Proper error stack traces and contexts
- Categorized logging by type (hooks, permissions, state, etc.)
- Centralized logging control
```

### Code Organization
The module now follows a more structured organization:

```
frinny/
├── scripts/
│   ├── managers/
│   │   ├── UIManager.js
│   │   └── AgentManager.js
│   ├── utils/
│   │   ├── characterUtils.js
│   │   ├── combatUtils.js
│   │   └── logUtils.js
│   └── main.js
```

### Event Handling
Events are now processed using utility functions for better maintainability:

1. Character Creation
   - Uses `isNewCharacter` and `canModifyCharacter` for validation
   - Gathers data using `gatherBasicCharacterData` and `gatherCharacterItems`
   - Consistent logging through `logUtils`

2. Combat
   - Combat start detection with `isCombatStarting`
   - Turn validation using `isUserCharacterTurn`
   - Data gathering with `gatherCombatStateData`
   - Enemy/Ally tracking with dedicated utility functions

3. Level Up
   - Validation through `isValidLevelUp` and `hasLevelIncreased`
   - Level change detection with `getLevelChange`
   - Data gathering using `gatherLevelUpData`

### Logging System
Implemented a comprehensive logging system that:
- Uses consistent prefix ("Frinny |")
- Provides context-aware logging
- Supports different log levels (DEBUG, INFO, WARN, ERROR)
- Includes specialized logging for different operations

### State Management
Improved state tracking with:
- Dedicated utility functions for data gathering
- Consistent state change logging
- Better error handling and reporting
- Clear validation chains

## State Management

### User Flags
The module uses Foundry's flag system to persist:
- Window position and size
- Window visibility state
- Avatar panel state (expanded/collapsed)
- Message history with configurable size (implemented)
- Feedback states for messages

### Settings
Configurable via Foundry's module settings:
- Avatar visibility toggle (global setting)
- Avatar panel state (per-user preference)
- Message history size (10-200 messages)
- (Future) AI behavior settings
- (Future) UI customization options

## Planned Features
1. AI Integration
   - Connect to backend service (in progress)
   - Handle API responses
   - Manage rate limiting
   - Implement error recovery strategies
   - WebSocket connection management

2. Character Creation
   - Class-first approach
   - Progress tracking
   - State persistence
   - Integration with Pathfinder 2E system

3. Combat Assistance
   - Turn suggestions
   - Action optimization
   - Rule clarifications
   - Combat state analysis
   - Tactical suggestions

4. Message History
   ✓ Persistent chat logs
   ✓ Message limit configuration
   ✓ Feedback state persistence
   - Context maintenance
   - Session management
   - Search functionality

## Development Guidelines
1. Use Foundry's built-in systems where possible
2. Maintain separation of concerns
3. Document new features
4. Use localization for all user-facing text
5. Persist state using Foundry's flag system
6. Test across different Foundry versions
7. Implement proper error handling
8. Follow modular design principles

## Testing
Current test coverage includes:
- Window state management
- UI interactions
- Chat command handling
- Message persistence
- Feedback system
- Mock AI responses

Needed test coverage:
- AI integration
- Character creation workflow
- Combat assistance features
- Multi-user scenarios

## Performance Considerations
1. Message History
   - Configurable limit to prevent memory issues
   - Efficient storage using Foundry flags
   - Cleanup of old messages
   - Optimized rendering

2. UI Responsiveness
   - Debounced input handling
   - Efficient DOM updates
   - Lazy loading of resources
   - Smooth animations

3. Resource Management
   - Memory usage optimization
   - Network request batching
   - Asset loading strategies
   - Cache management

## Security Considerations
1. Data Storage
   - Secure handling of user data
   - Proper scope isolation
   - Permission management
   - Data sanitization

2. Permission Management
   - Explicit ownership checks using Foundry's permission levels
   - Special handling for GM users
   - Designated character validation
   - Prevention of unauthorized character modifications
   - Permission level constants from CONST.DOCUMENT_OWNERSHIP_LEVELS
   - Proper handling of system-specific permission defaults

3. Logging System
   - Structured logging with consistent "Frinny |" prefix
   - Detailed context objects for debugging
   - Explicit success/failure logging
   - Hook execution tracking
   - Permission decision logging
   - Error state capture
   - Performance monitoring
   - State change tracking

## Logging Guidelines
1. Hook Execution
   - Log when hooks are triggered with relevant context
   - Log skip conditions with clear reasoning
   - Include user and character IDs where relevant
   - Track ownership and permission states

2. State Changes
   - Log UI state changes (window position, visibility)
   - Track character sheet modifications
   - Monitor combat state transitions
   - Record backend communication status

3. Error Handling
   - Structured error logging with full context
   - Clear error messages for debugging
   - Stack traces for critical errors
   - Recovery attempt logging
   - User-facing error state management

4. Debug Information
   - Permission levels and ownership details
   - Character state changes
   - Combat turn processing
   - Backend communication status
   - UI state transitions

## Permission Implementation
1. Character Sheet Access
   ```javascript
   // Get user's permission level
   const userPermissionLevel = actor.getUserLevel(game.user);
   const isGM = game.user.isGM;

   // Check explicit ownership for non-GM users
   if (!isGM && userPermissionLevel !== CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
       return; // Skip if not explicit owner
   }

   // For GMs, validate designated character
   if (isGM) {
       const designatedCharacter = game.user.character;
       if (!designatedCharacter || designatedCharacter.id !== actor.id) {
           return; // Skip if not GM's designated character
       }
   }
   ```

2. Permission Levels
   - NONE (0): No access
   - LIMITED (1): Limited viewing
   - OBSERVER (2): Can view but not modify
   - OWNER (3): Full control
   - DEFAULT: System default permission level

3. Implementation Considerations
   - Always check explicit ownership
   - Handle GM permissions separately
   - Validate designated characters
   - Log permission decisions
   - Consider system-specific defaults
   - Maintain proper scope isolation

## Maintenance
1. Regular Updates
   - Version compatibility
   - Dependencies management
   - Feature deprecation
   - Documentation updates

2. User Support
   - Error logging
   - Debugging tools
   - User feedback collection
   - Performance monitoring

## Usage

### For Users
1. Access via scene controls (robot icon)
2. Toggle window with chat icon
3. Type messages in input field
4. Use !frinny command in chat
5. Provide feedback on responses
6. Toggle avatar panel with chevron button
7. Avatar state persists between sessions

### For Developers
1. Extend FrinnyChat class for new features
2. Add hooks in main.js for new functionality
3. Update template for UI changes
4. Add styles in CSS file
5. Add new translations in language files