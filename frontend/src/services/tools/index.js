/**
 * Tools Service Index
 * Main export for tools functionality
 */
import ToolRegistry from './registry';
import SummaryGenerator from './summaryGenerator';
import GeminiFunctionCaller from './GeminiFunctionCaller';
import * as toolDefinitions from './sharedToolDefinitions';

// Get the function we need from the imported module
const { getToolDefinitionsByLocation } = toolDefinitions;

// Initialize tool registry
const toolRegistry = new ToolRegistry();

// Register tools
toolRegistry.registerTool('summary', SummaryGenerator);

// Register any frontend tools defined in shared definitions
const frontendTools = getToolDefinitionsByLocation('frontend');
const bothTools = getToolDefinitionsByLocation('both');

// Combine tools that can be executed on frontend
const allFrontendTools = [...frontendTools, ...bothTools];

// Register tools that have frontend implementations
// Note: Currently only summary is registered as it has an implementation
// This comment is left as a placeholder for future tools with frontend implementations

// Create Gemini function caller
const geminiFunctionCaller = new GeminiFunctionCaller(toolRegistry);

export { 
  toolRegistry as default,
  geminiFunctionCaller,
  SummaryGenerator
}; 