import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  EmailSummary, 
  EmailClassification, 
  EmailAnalytics, 
  EmailMessage
} from '../types';

export class AiService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

/**
   * Generate email summary using AI
   */
  async summarizeEmail(subject: string, body: string): Promise<EmailSummary | null> {
    if (!this.genAI) {
      console.warn('Gemini API key not configured, skipping AI summary');
      return null;
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `Analyze this email and provide a concise summary:
        
Subject: ${subject}
Body: ${body.substring(0, 2000)}${body.length > 2000 ? '...' : ''}
        
Please provide a JSON response with the following structure:
{
  "summary": "Brief summary of the email content",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "sentiment": "positive|negative|neutral",
  "urgency": "high|medium|low",
  "category": "work|personal|spam|other",
  "language": "English|Spanish|...",
  "actionItems": ["Action 1", "Action 2"],
  "meetingInfo": {
    "hasDateTime": true,
    "dateTime": "2023-01-01T10:00:00Z",
    "location": "Virtual",
    "attendees": ["john@example.com", "jane@example.com"]
  },
  "contacts": {
    "emails": ["contact@example.com"],
    "phones": ["123456789"],
    "names": ["John Doe"]
  }
}
        
Focus on extracting actionable information and determining the email's importance.`;

      const response = await model.generateContent(prompt);
      const result = await response.response;
      const text = result.text();

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            summary: parsed.summary || 'No summary available',
            keyPoints: parsed.keyPoints || [],
            sentiment: parsed.sentiment || 'neutral',
            urgency: parsed.urgency || 'medium',
            category: parsed.category || 'other',
            language: parsed.language || 'English',
            actionItems: parsed.actionItems || [],
            meetingInfo: parsed.meetingInfo || undefined,
            contacts: parsed.contacts || { emails: [], phones: [], names: [] },
          };
        }
      } catch (parseError) {
        console.warn('Failed to parse AI response as JSON:', parseError);
      }

      // Fallback: create basic summary from text response
      return {
        summary: text.substring(0, 200),
        keyPoints: [],
        sentiment: 'neutral',
        urgency: 'medium',
        category: 'other',
        language: 'English',
        actionItems: [],
        contacts: { emails: [], phones: [], names: [] },
      };
    } catch (error) {
      console.error('AI summarization failed:', error);
      return null;
    }
  }

  /**
   * Classify email category
   */
  async classifyEmail(subject: string, body: string): Promise<EmailClassification | null> {
    if (!this.genAI) {
      console.warn('Gemini API key not configured, skipping classification');
      return null;
    }

    try {
      const prompt = `Classify the following email into categories like work, personal, finance, etc.:
        
Subject: ${subject}
Body: ${body.substring(0, 1000)}`;

      const response = await this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }).generateContent(prompt);
      const result = await response.response;
      const text = result.text();
      
      try {
        const category = text.match(/Category: ([^\n]+)/);
        const confidence = text.match(/Confidence: ([\d.]+)/);
        if (category && confidence && confidence[1]) {
          return {
            category: category[1] as 'work' | 'personal' | 'finance' | 'travel' | 'shopping' | 'social' | 'newsletter' | 'spam' | 'other',
            confidence: parseFloat(confidence[1]),
          };
        }
      } catch (error) {
        console.warn('Failed to classify email:', error);
      }

      return null;
    } catch (error) {
      console.error('AI classification failed:', error);
      return null;
    }
  }
  
  /**
   * Analyze email for detailed analytics
   */
  async analyzeEmail(email: EmailMessage): Promise<EmailAnalytics | null> {
    try {
      const wordCount = email.body.split(/\s+/).length;
      const readingTime = Math.ceil(wordCount / 200); // 200 wpm average reading speed
      const hasLinks = email.body.includes('http');
      const hasImages = !!email.attachments?.find(att => att.contentType.startsWith('image/'));

      return {
        threadLength: email.references?.length || 0,
        isNewsletter: email.labels?.includes('newsletter') || false,
        hasLinks,
        hasImages,
        wordCount,
        readingTime,
      };
    } catch (error) {
      console.error('Failed to analyze email:', error);
      return null;
    }
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean {
    return this.genAI !== null;
  }

  /**
   * Detect sentiment
   */
  async detectSentiment(subject: string, body: string): Promise<'strongly positive' | 'positive' | 'neutral' | 'negative' | 'strongly negative' | null> {
    if (!this.genAI) {
      console.warn('Gemini API key not configured, skipping sentiment detection');
      return null;
    }

    try {
      const prompt = `Detect the sentiment of this email as one of strongly positive, positive, neutral, negative, strongly negative:
        
Subject: ${subject}
Body: ${body.substring(0, 500)}`;

      const response = await this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }).generateContent(prompt);
      const result = await response.response;
      const text = result.text();

      const sentimentMatch = text.match(/Sentiment: ([^\n]+)/);
      if (sentimentMatch) {
        return sentimentMatch[1] as 'strongly positive' | 'positive' | 'neutral' | 'negative' | 'strongly negative';
      }
    } catch (error) {
      console.error('Sentiment detection failed:', error);
      return null;
    }
    return null;
  }

  /**
   * Get AI service status
   */
  getStatus(): { available: boolean; provider: string } {
    return {
      available: this.isAvailable(),
      provider: this.genAI ? 'Gemini' : 'None',
    };
  }
} 