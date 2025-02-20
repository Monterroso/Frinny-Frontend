PF2e AI Agent Module Technical Design Document
Version 1.0 | Last Updated: February 19, 2025
Author: AI Assistant (via Perplexity)

Table of Contents

Project Overview

Technical Requirements

Architecture Design

Implementation Steps

Anti-Pattern Prevention

Testing Strategy

Deployment Checklist

Future-Proofing

Project Overview

This project aims to build a Foundry VTT module for Pathfinder 2e (PF2e) that provides:

Per-user AI agents with isolated chat histories

Integration with Foundry's game data (actors, items, rules)

State maintenance across sessions

Real-time updates via WebSockets

Configurable features (e.g., avatars)

Technical Requirements

Requirement: Per-user state isolation
Solution: Centralized state store scoped by user ID
Tools/APIs: Map, Foundry flags

Requirement: Real-time updates
Solution: WebSocket communication
Tools/APIs: socketlib

Requirement: UI persistence
Solution: DOM virtualization with user IDs
Tools/APIs: Handlebars, CSS scoping

Requirement: Config synchronization
Solution: Foundry settings API
Tools/APIs: game.settings

Requirement: API integration
Solution: Proxy service with rate limiting
Tools/APIs: Fetch, Axios

Architecture Design

3.1 Module Structure

/pf2e-ai-agent
├── /scripts
│ ├── agent-manager.js # Core logic
│ ├── user-session.js # Per-user state
│ └── socket-handler.js # WebSocket logic
├── /styles
│ └── chat.scss # Scoped CSS
├── /templates # Handlebars
│ └── ai-chat.hbs
├── module.json # Manifest
└── main.js # Entry point

3.2 State Management

// user-session.js
export class UserSession {
constructor(userId) {
this.userId = userId;
this.history = [];
this.lastActive = Date.now();
}

addMessage(message) {
return new UserSession(this.userId, [...this.history, message]);
}
}

export const sessions = new Map();

3.3 Communication Layer

// socket-handler.js
import { socket } from "./main.js";

socket.register("aiMessage", async (userId, msg) => {
const session = sessions.get(userId);
const response = await AI.process(msg, session);
socket.executeForUser(userId, "updateChat", response);
});

3.4 UI Components

<!-- templates/ai-chat.hbs --> <div class="ai-chat" data-user-id="{{userId}}"> {{#each messages}} <div class="message">{{this}}</div> {{/each}} <input type="text" class="ai-input"> </div>
Implementation Steps

4.1 Core Systems Setup

Hooks.once('init', () => {
game.modules.get('pf2e-ai-agent').api = { /* Public methods */ };
});

Hooks.on('ready', () => {
const saved = game.world.getFlag('pf2e-ai-agent', 'sessions');
sessions = new Map(saved);
});

4.2 Real-Time Chat System

class AIChatForm extends ChatLog {
async _sendMessage(message) {
await socket.executeAsGM("aiMessage", game.userId, message);
}
}

4.3 State Persistence

Hooks.on('closeApplication', async (app) => {
if (app instanceof AIChatForm) {
await game.world.setFlag('pf2e-ai-agent', 'sessions', [...sessions]);
}
});

4.4 Configuration Integration

game.settings.register('pf2e-ai-agent', 'showAvatar', {
// ...
onChange: () => {
document.querySelectorAll('.ai-avatar').forEach(el => {
el.hidden = !game.settings.get('pf2e-ai-agent', 'showAvatar');
});
}
});

Anti-Pattern Prevention

Single Source of Truth: All state mutations through UserSession class methods.

Race Condition Guard:
let isProcessing = false;
async function sendMessage(msg) {
if (isProcessing) return;
isProcessing = true;
// ...
isProcessing = false;
}

Testing Strategy

Test Type: State Serialization
Tools: Jest
Coverage: Verify Map ↔ JSON conversion

Test Type: UI Isolation
Tools: Puppeteer
Coverage: Confirm per-user DOM separation

Test Type: Socket Reliability
Tools: Artillery
Coverage: Load-test WebSocket messages

Deployment Checklist

Validate PF2e system compatibility

Test permission levels (GM vs player)

Minify scripts with rollup

Document public API methods

Future-Proofing

Modular Design:
// Feature flagging example
if (FEATURE_FLAGS.AI_VOICE) {
import('./voice-module.js');
}

Dependency Isolation: Wrap third-party libs in adapter classes.

This document provides a comprehensive blueprint for the PF2e AI Agent Module, emphasizing strict separation of concerns. Implementation should begin with the state management core and socket layer before progressing to UI components.