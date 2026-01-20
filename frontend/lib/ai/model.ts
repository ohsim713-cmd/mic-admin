import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

export function getModel() {
  const modelId = process.env.AI_MODEL || 'gemini-2.0-flash';

  switch (modelId) {
    case 'claude-3.5-haiku':
      return anthropic('claude-3-5-haiku-20241022');
    case 'gemini-2.0-flash':
      return google('gemini-2.0-flash');
    case 'gemini-2.5-flash':
      return google('gemini-2.5-flash');
    case 'gemini-3-flash':
      return google('gemini-3-flash-preview');
    case 'gemini-2.5-pro':
      return google('gemini-2.5-pro');
    case 'gemini-3-pro':
      return google('gemini-3-pro-preview');
    case 'claude-sonnet-4':
      return anthropic('claude-sonnet-4-20250514');
    // OpenAI models
    case 'gpt-4o':
      return openai('gpt-4o');
    case 'gpt-4o-mini':
      return openai('gpt-4o-mini');
    case 'gpt-4.1':
      return openai('gpt-4.1');
    case 'gpt-4.1-mini':
      return openai('gpt-4.1-mini');
    case 'gpt-4.1-nano':
      return openai('gpt-4.1-nano');
    case 'o3-mini':
      return openai('o3-mini');
    default:
      return google('gemini-2.0-flash');
  }
}
