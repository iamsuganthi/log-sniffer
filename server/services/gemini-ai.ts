import { GoogleGenAI } from "@google/genai";
import { AuditLog } from "../../shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateExecutiveSummary(auditLogs: AuditLog[]): Promise<string> {
  try {
    console.log("Starting executive summary generation...");
    console.log("GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY);
    console.log("Total audit logs received:", auditLogs.length);
    
    if (!process.env.GEMINI_API_KEY) {
      return "AI analysis unavailable - no API key configured";
    }

    // Filter logs from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = auditLogs.filter(log => new Date(log.created) >= oneDayAgo);
    
    const logSummary = recentLogs.slice(0, 200).map(log => ({
      event: log.event,
      created: log.created,
      content: log.content
    }));

    console.log(`Generating summary for ${recentLogs.length} recent logs out of ${auditLogs.length} total logs`);
    
    if (recentLogs.length === 0) {
      return "No recent audit logs found in the last 24 hours. Please check if your Snyk organization has recent activity.";
    }

    // Create a simplified summary first
    const eventSummary = logSummary.reduce((acc, log) => {
      acc[log.event] = (acc[log.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const uniqueUsers = new Set(logSummary.map(log => {
      const content = log.content as any;
      return content?.user_email || content?.user_id || 'Unknown';
    })).size;

    // Get top 5 most frequent events
    const topEvents = Object.entries(eventSummary)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([event, count]) => `${event}: ${count}`)
      .join(', ');

    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'UTC'
    });
    
    const prompt = `Create a comprehensive executive security summary for Snyk audit events from the last 24 hours.

IMPORTANT: Today's date is ${currentDate}. Use this as the report date and reference timeframe.

Event Data: ${logSummary.length} events, ${uniqueUsers} users
Top Events: ${topEvents}

Generate a detailed executive report with these sections:

## Executive Security Summary

### 🔍 Activity Overview
Provide a thorough assessment of security activity and operational posture over the last 24 hours. Include the current date (${currentDate}) in your analysis.

### 🚨 Critical Events
Analyze the top security events by frequency and potential impact, including specific details about each event type.

### ⚠️ Risk Analysis
Evaluate security concerns, threat patterns, and vulnerability implications from the logged activities.

### 👥 User Activity Insights
Examine user behavior patterns, access trends, and any anomalies in user actions.

### 📋 Recommendations
Provide detailed, prioritized actionable steps for leadership with High/Medium/Low priority levels and business impact analysis.

### 📊 Key Metrics & Trends
Present comprehensive statistics including event frequencies, user engagement, and security posture indicators.

Create a professional, detailed executive-level analysis with complete sections. Use proper Markdown formatting with headers, bullet points, bold text, and comprehensive insights.`;

    console.log("Sending prompt to Gemini API...");
    console.log("Prompt length:", prompt.length);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 4096,
        temperature: 0.1,
        topP: 0.9,
        topK: 40,
      }
    });

    console.log("Gemini response received, has text:", !!response.text);
    console.log("Response text length:", response.text?.length || 0);
    
    // More detailed debugging
    console.log("Full response structure:", JSON.stringify(response, null, 2));
    
    if (!response.text) {
      console.error("No text in response, candidates:", response.candidates?.length || 0);
      
      // Try to extract text from candidates with detailed logging
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        console.log("Candidate structure:", JSON.stringify(candidate, null, 2));
        
        if (candidate.content?.parts && candidate.content.parts.length > 0) {
          const text = candidate.content.parts[0].text;
          if (text) {
            console.log("Found text in candidate parts:", text.length);
            return text;
          }
        }
        
        // Check for safety ratings or blocked content
        if (candidate.safetyRatings) {
          console.log("Safety ratings:", candidate.safetyRatings);
        }
        if (candidate.finishReason) {
          console.log("Finish reason:", candidate.finishReason);
          
          // Handle MAX_TOKENS specifically
          if (candidate.finishReason === "MAX_TOKENS") {
            return `## Security Summary

### Activity
${logSummary.length} Snyk audit events recorded in the last 24 hours involving ${uniqueUsers} user(s).

### Key Events
${Object.entries(eventSummary).sort(([,a], [,b]) => b - a).slice(0, 3).map(([event, count]) => `- ${event}: ${count} occurrences`).join('\n')}

### Concerns
High activity volume from single user requires review of access patterns and role assignments.

### Actions
- Review user permissions and access controls
- Investigate unusual activity patterns
- Consider implementing additional monitoring alerts

*Note: Full AI analysis unavailable due to response length limitations.*`;
          }
        }
      }
      
      return `Unable to generate summary. The AI service may have filtered the content. Total events analyzed: ${logSummary.length}, Users: ${uniqueUsers}. Please try with a different time period or contact support.`;
    }

    console.log("Successfully generated summary of length:", response.text.length);
    return response.text;
  } catch (error: any) {
    console.error("Executive summary error:", error);
    return `Summary generation error: ${error.message}`;
  }
}

export async function analyzeAuditLogs(auditLogs: AuditLog[]): Promise<string[]> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return ["AI analysis unavailable - no API key configured"];
    }

    const logSummary = auditLogs.slice(0, 100).map(log => ({
      event: log.event,
      created: log.created,
      content: log.content
    }));

    const prompt = `
Analyze these Snyk audit logs and provide security insights:

${JSON.stringify(logSummary, null, 2)}

Please provide:
1. Key security events summary
2. Risk patterns or anomalies
3. Recommendations for improvement
4. Overall security posture assessment

Format as a JSON array of string insights.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const result = response.text || "No insights generated";
    
    try {
      const insights = JSON.parse(result);
      return Array.isArray(insights) ? insights : [result];
    } catch {
      return [result];
    }
  } catch (error: any) {
    console.error("AI analysis error:", error);
    return [`Analysis error: ${error.message}`];
  }
}

export async function chatWithAI(
  message: string, 
  auditLogs: AuditLog[], 
  previousMessages: any[]
): Promise<string> {
  try {
    console.log("Starting chat with AI, message:", message);
    console.log("Audit logs count:", auditLogs.length);
    console.log("Previous messages count:", previousMessages.length);
    
    if (!process.env.GEMINI_API_KEY) {
      console.log("No GEMINI_API_KEY found");
      return "AI chat unavailable - no API key configured. Please contact your administrator.";
    }

    const context = auditLogs.slice(0, 50).map(log => ({
      event: log.event,
      created: log.created,
      content: log.content
    }));

    const systemPrompt = `You are a security analyst assistant for Snyk audit logs. 
You have access to recent audit log data and can help users understand security events, 
identify patterns, and provide recommendations.

Recent audit logs context:
${JSON.stringify(context, null, 2)}

Previous conversation:
${previousMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Current user message: ${message}

IMPORTANT: Respond in PLAIN TEXT format only. Do not use Markdown formatting like **bold**, *italics*, # headers, - bullet points, ## headings, or any other Markdown syntax. Use simple text with line breaks for readability.

Please provide helpful, security-focused responses based on the audit log data using plain text formatting only.`;

    console.log("Calling Gemini API...");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: systemPrompt,
    });

    console.log("Gemini response received:", response.text ? "Yes" : "No");
    const result = response.text || "I apologize, but I couldn't process your request at this time.";
    console.log("Final response length:", result.length);
    
    return result;
  } catch (error: any) {
    console.error("Chat error:", error);
    return `I encountered an error: ${error.message}. Please try again.`;
  }
}