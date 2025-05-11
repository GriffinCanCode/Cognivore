/**
 * Tools Service Index
 * Main export for tools functionality
 */
import ToolRegistry from './registry';
import SummaryGenerator from './summaryGenerator';
import GeminiFunctionCaller from './GeminiFunctionCaller';

// Initialize tool registry
const toolRegistry = new ToolRegistry();

// Register tools
toolRegistry.registerTool('summary', SummaryGenerator);

// Create Gemini function caller
const geminiFunctionCaller = new GeminiFunctionCaller(toolRegistry);

export { 
  toolRegistry as default,
  geminiFunctionCaller,
  SummaryGenerator
}; 