# Frinny - AI Assistant Module Implementation

## Overview
Frinny is a Foundry VTT module that provides an AI assistant interface specifically designed for Pathfinder 2E. The module creates a floating, persistent chat window that allows players and GMs to interact with an AI assistant for character creation, leveling, and combat assistance.

## File Structure
```
frinny/
├── scripts/
│   ├── managers/
│   │   └── UIManager.js     # Core UI handling
│   └── main.js              # Module entry point
├── styles/
│   └── frinny-chat.css      # UI styling
├── templates/
│   └── frinny-chat.hbs      # Chat interface template
├── languages/
│   └── en.json              # English localization
├── assets/
│   └── images/
│       └── default.png      # Default Frinny avatar
└── module.json              # Module manifest
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

#### Important Methods:
```javascript
constructor(options = {})
- Initializes chat window state
- Sets up message history
- Loads saved position and visibility
- Loads avatar panel state

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

_handleMessageSend(content)
- Processes user messages
- Triggers AI response
- Updates chat interface

_handleFeedback(messageId, type)
- Handles user feedback on responses
```

### 2. main.js
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

### 3. frinny-chat.hbs
Handlebars template for the chat interface.

#### Components:
- Collapsible avatar panel with Frinny's image
- Toggle button for avatar panel visibility
- Message history display
- Typing indicator
- Message input area
- Feedback buttons for responses

### 4. frinny-chat.css
Styling for the chat interface.

#### Key Styles:
- Responsive layout
- Message bubbles
- Typing animation
- Feedback button styling
- Window positioning
- Animated avatar panel transitions
- Collapsible panel animations

### 5. en.json
Localization file for UI text.

#### Contains:
- Setting names and descriptions
- UI placeholder text
- Status messages
- Button labels

## State Management

### User Flags
The module uses Foundry's flag system to persist:
- Window position
- Window visibility
- Avatar panel state (expanded/collapsed)
- Chat history (planned)

### Settings
Configurable via Foundry's module settings:
- Avatar visibility toggle (global setting)
- Avatar panel state (per-user preference)
- (Future) AI behavior settings
- (Future) UI customization options

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

## Planned Features
1. AI Integration
   - Connect to backend service
   - Handle API responses
   - Manage rate limiting

2. Character Creation
   - Class-first approach
   - Progress tracking
   - State persistence

3. Combat Assistance
   - Turn suggestions
   - Action optimization
   - Rule clarifications

4. Message History
   - Persistent chat logs
   - Context maintenance
   - Session management

## Development Guidelines
1. Use Foundry's built-in systems where possible
2. Maintain separation of concerns
3. Document new features
4. Use localization for all user-facing text
5. Persist state using Foundry's flag system
6. Test across different Foundry versions

## Testing
Current test coverage includes:
- Window state management
- UI interactions
- Chat command handling

Needed test coverage:
- AI integration
- Character creation workflow
- Combat assistance features
- Multi-user scenarios 