const { buildClaudeSystemPrompt } = require('./src/lib/clinical/conversation.js');
console.log("length:", buildClaudeSystemPrompt({ phase: "consent", phaseStep: 0, data: {}, consentGiven: false, complete: false }).length);
