# Technical Specification

## System Overview
The Frinny module is a FoundryVTT extension designed to integrate an AI-driven assistant into the virtual tabletop experience. The system facilitates real-time interaction between users and the AI, handling state changes and events on the frontend, and communicating with a Flask backend via websockets with an HTTP fallback. The module consists of frontend components for user interaction, a Flask backend for AI processing, and websockets for real-time communication.

### Main Components
- **Frontend**: Handles user interactions and displays AI responses.
  - **`frinny/scripts/main.js`**: Entry point for the frontend script.
  - **`frinny/scripts/managers/AgentManager.js`**: Manages websocket connections and communication with the backend.
  - **`frinny/scripts/managers/UIManager.js`**: Manages the UI and user interactions.
  - **`frinny/scripts/utils/*`**: Utility functions for character, combat, and log management.
  - **`frinny/styles/frinny-chat.css`**: Styles for the chat interface.
  - **`frinny/templates/frinny-chat.hbs`**: Template for the chat interface.
- **Backend**: Processes AI requests and sends responses.
  - **Flask Application**: Handles websocket and HTTP requests.
- **Websockets**: Provides real-time bidirectional communication between frontend and backend.
- **HTTP**: Fallback mechanism for communication when websockets are unavailable.

## Core Functionality
The core functionality of the Frinny module revolves around real-time communication with the AI, handling various game events, and providing a seamless user experience.

### AgentManager.js
**Importance Score: 90**

The `AgentManager` class is central to managing all interactions with the Frinny AI backend service, primarily through websockets.

#### Key Functions:
- **`connect()`**
  - **Importance Score: 100**
  - Initializes the Socket.IO connection to the backend.
  - Handles connection events like `connect`, `disconnect`, and `connect_error`.
  - Sets up message handlers for various events (`typing_status`, `query_response`, `character_creation_response`, `combat_suggestion`, `level_up_response`).

- **`_emitAndWait(eventName, data)`**
  - **Importance Score: 95**
  - Sends a message to the backend and waits for a response.
  - Manages pending requests and handles timeouts.
  - Logs communication details and errors.

- **`_handleSocketResponse(requestId, data)`**
  - **Importance Score: 85**
  - Resolves a pending request with the received data.

- **`_handleSocketError(requestId, error)`**
  - **Importance Score: 85**
  - Rejects a pending request with the provided error.

- **`handlePrivateQuery(userId, content)`**
  - **Importance Score: 90**
  - Handles queries from the private chat window.
  - Gathers conversation history and sends it to the backend.

- **`handlePublicQuery(userId, content)`**
  - **Importance Score: 90**
  - Handles queries from the public chat.
  - Gathers recent messages and sends them to the backend.

- **`notifyCharacterCreation(context)`**
  - **Importance Score: 90**
  - Notifies the backend about new character creation.
  - Uses websockets if connected, otherwise falls back to HTTP.

- **`notifyCombatTurn(combatState)`**
  - **Importance Score: 90**
  - Notifies the backend about a combat turn.
  - Uses websockets if connected, otherwise falls back to HTTP.

- **`notifyLevelUp(levelUpData)`**
  - **Importance Score: 90**
  - Notifies the backend about a character level up.
  - Uses websockets if connected, otherwise falls back to HTTP.

- **`notifyCombatStart(combatData)`**
  - **Importance Score: 90**
  - Notifies the backend about the start of combat.
  - Uses websockets if connected, otherwise falls back to HTTP.

- **`submitFeedback(messageId, type)`**
  - **Importance Score: 80**
  - Submits feedback for a message to the backend using HTTP.

- **`_sendRequest(endpoint, data)`**
  - **Importance Score: 85**
  - Sends an HTTP request to the backend.
  - Used as a fallback when websockets are not available.

### FrinnyChat.js
**Importance Score: 85**

The `FrinnyChat` class manages the UI and interaction with the Frinny AI, including handling messages and feedback.

#### Key Functions:
- **`_handlePrivateMessage(content)`**
  - **Importance Score: 85**
  - Handles sending a message to Frinny from the private chat window.
  - Adds the user message and the AI response to the private chat.

- **`_handlePublicMessage(content)`**
  - **Importance Score: 85**
  - Handles sending a message to Frinny from the public chat.
  - Creates a Foundry chat message for Frinny's response.

- **`_handleMessageSend(content, isFromMainChat)`**
  - **Importance Score: 85**
  - Routes message handling based on whether the message originated from the main chat or private chat.

- **`_handleFeedback(messageId, type)`**
  - **Importance Score: 80**
  - Handles submitting feedback for a message to the backend.

### Data Flow and Communication
- **Frontend to Backend:**
  - **`query`**: Sent when a user sends a message to Frinny. Contains the message content and conversation history.
  - **`character_creation_start`**: Sent when a new character is created. Contains character creation context.
  - **`combat_turn`**: Sent when a combat turn occurs. Contains the current combat state.
  - **`level_up`**: Sent when a character levels up. Contains level up context data.

- **Backend to Frontend:**
  - **`typing_status`**: Indicates whether Frinny is currently typing a response.
  - **`query_response`**: Contains Frinny's response to a user query.
  - **`character_creation_response`**: Acknowledges the receipt of character creation data.
  - **`combat_suggestion`**: Provides combat suggestions based on the current state.
  - **`level_up_response`**: Acknowledges the receipt of level up data.

### Error Handling
- The `AgentManager` class handles errors by logging them and rejecting pending requests when necessary.
- Fallback to HTTP is implemented for critical operations if websockets are not available.

## Architecture
The Frinny module is structured to facilitate real-time, bidirectional communication between the frontend and backend. The frontend components manage user interactions and display AI responses, while the backend processes AI requests and sends responses. Websockets are the primary communication channel, with HTTP serving as a fallback.

### Data Flow
1. **User Interaction**:
   - Users send messages or trigger events (e.g., character creation, combat turns) through the frontend.
2. **Frontend Processing**:
   - The `FrinnyChat` class handles UI interactions and routes messages to the `AgentManager`.
3. **Websocket Communication**:
   - The `AgentManager` establishes a websocket connection and sends events to the backend.
   - The backend processes the events and sends responses back via websockets.
4. **HTTP Fallback**:
   - If websockets are unavailable, the `AgentManager` falls back to HTTP requests.
5. **Response Handling**:
   - The `AgentManager` handles responses and updates the UI accordingly.