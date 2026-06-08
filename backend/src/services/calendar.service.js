const geminiProvider = require('../providers/gemini.provider');
const CalendarEvent = require('../models/CalendarEvent.model');

/**
 * Extract date entities from text response.
 * 
 * @param {string} text - The chat answer text containing potential dates.
 * @returns {Promise<Array<{title: string, startTime: string, endTime: string|null, description: string}>>}
 */
const extractDatesFromText = async (text) => {
  try {
    const todayStr = 'Thursday, June 4, 2026';
    const systemPrompt = `You are a calendar assistant. Today is ${todayStr}. Analyze the user text and extract any events, meetings, exams, deadlines, or dates mentioned. Return the results ONLY as a valid JSON array of objects. Do not include markdown wraps (like \`\`\`json).
Each object must have the following fields:
- "title": (string) A concise name for the event.
- "startTime": (string, ISO 8601 format like YYYY-MM-DDTHH:mm:ssZ) The starting time/date. If no specific time is mentioned, default to 09:00:00.
- "endTime": (string, ISO 8601 format or null) The ending time/date. If not mentioned, default to 1 hour after startTime.
- "description": (string) Any additional details or description from the text.

If no events or dates are found, return an empty array: []`;

    const prompt = `Text to analyze:\n"${text}"\n\nJSON Output:`;
    const response = await geminiProvider.generateText(prompt, systemPrompt);

    // Clean response in case of markdown formatting
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.substring(7);
    }
    if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.substring(3);
    }
    if (cleanResponse.endsWith('```')) {
      cleanResponse = cleanResponse.substring(0, cleanResponse.length - 3);
    }
    cleanResponse = cleanResponse.trim();

    const events = JSON.parse(cleanResponse);
    if (Array.isArray(events)) {
      return events;
    }
    return [];
  } catch (error) {
    console.error('Error extracting dates from text:', error);
    return [];
  }
};

/**
 * Create and save a CalendarEvent to MongoDB.
 */
const createCalendarEvent = async (userId, title, startTime, endTime, chatLogId) => {
  try {
    const parsedStart = new Date(startTime);
    const parsedEnd = endTime ? new Date(endTime) : new Date(parsedStart.getTime() + 60 * 60 * 1000);

    const event = new CalendarEvent({
      user: userId,
      title,
      start_time: parsedStart,
      end_time: parsedEnd,
      event_date: parsedStart,
      event_description: `Extracted from ChatLog ${chatLogId}`,
      source_chat_log: chatLogId
    });

    await event.save();
    return event;
  } catch (error) {
    console.error('Error saving CalendarEvent:', error);
    throw error;
  }
};

module.exports = {
  extractDatesFromText,
  createCalendarEvent
};
