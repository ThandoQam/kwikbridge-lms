// KwikBridge LMS — AI Loan Application Assistant (ENH-01)
// Conversational onboarding that guides borrowers through application.
// Uses Anthropic API (Claude) for natural conversation, falls back to standard form.
//
// Flow: Chat → extract structured data → auto-populate application form → submit

import type { Product, Customer } from "../types/index";

// ═══ Types ═══

export interface ConversationMessage {
  role: "assistant" | "user";
  content: string;
  timestamp: number;
}

export interface ExtractedAppData {
  loanAmount?: number;
  loanTerm?: number;
  purpose?: string;
  businessName?: string;
  industry?: string;
  revenue?: number;
  employees?: number;
  yearsInBusiness?: number;
  beeLevel?: number;
  recommendedProduct?: string;
  confidence: number;          // 0-1
}

export interface AssistantState {
  messages: ConversationMessage[];
  extractedData: ExtractedAppData;
  stage: "greeting" | "needs" | "business" | "product" | "review" | "complete";
  suggestedProduct: Product | null;
  error: string | null;
}

// ═══ System Prompt ═══

const SYSTEM_PROMPT = `You are KwikBridge, a friendly and professional loan application assistant for TQA Capital (Pty) Ltd, a registered credit provider (NCRCP22396) in South Africa.

Your role is to help small and medium business owners apply for financing. You ask questions ONE AT A TIME in a conversational, supportive tone. Never ask multiple questions at once.

CONVERSATION FLOW:
1. GREETING: Welcome the borrower warmly. Ask what kind of financing they need.
2. NEEDS: Ask about loan amount needed, then purpose/use of funds.
3. BUSINESS: Ask about their business (name, industry, years operating, approximate annual revenue, number of employees).
4. BEE: Ask about BEE level (explain briefly if they're unsure).
5. PRODUCT: Based on their answers, recommend the best-fit product. Explain why it suits them.
6. REVIEW: Summarise everything and ask them to confirm before proceeding.

IMPORTANT RULES:
- Use simple, clear language. Many borrowers are first-time applicants.
- Amounts in South African Rand (R).
- Be encouraging — these are entrepreneurs building businesses.
- If they mention hardship, be empathetic but stay professional.
- Never promise approval — say "subject to credit assessment."
- Keep responses under 3 sentences unless explaining a product.

When you have enough information to recommend a product, include this JSON block at the end of your message (the UI will parse it):
<extracted>{"loanAmount":500000,"loanTerm":24,"purpose":"equipment","businessName":"ABC Trading","industry":"Manufacturing","revenue":5000000,"employees":15,"yearsInBusiness":4,"beeLevel":2}</extracted>

Available products (recommend based on amount, purpose, and BEE level):
PRODUCTS_PLACEHOLDER`;

// ═══ Conversation Manager ═══

export function createAssistantState(): AssistantState {
  return {
    messages: [{
      role: "assistant",
      content: "Welcome to KwikBridge! I'm here to help you apply for business financing from TQA Capital.\n\nTo get started, could you tell me a little about what kind of financing you're looking for? For example, do you need funds for equipment, working capital, transport, or something else?",
      timestamp: Date.now(),
    }],
    extractedData: { confidence: 0 },
    stage: "greeting",
    suggestedProduct: null,
    error: null,
  };
}

/**
 * Send a message to the AI assistant and get a response.
 * Falls back gracefully if AI is unavailable.
 */
export async function sendMessage(
  state: AssistantState,
  userMessage: string,
  products: Product[],
  apiEndpoint?: string
): Promise<AssistantState> {
  // Add user message
  const messages = [
    ...state.messages,
    { role: "user" as const, content: userMessage, timestamp: Date.now() },
  ];

  try {
    // Build system prompt with real products
    const productList = products
      .filter(p => p.status === "Active")
      .map(p => `- ${p.name}: R${p.minAmount.toLocaleString()}-R${p.maxAmount.toLocaleString()}, ${p.minTerm}-${p.maxTerm} months, ${p.baseRate}% p.a., ${p.repaymentType}. ${p.idealFor}`)
      .join("\n");

    const systemPrompt = SYSTEM_PROMPT.replace("PRODUCTS_PLACEHOLDER", productList);

    // Call Anthropic API
    const endpoint = apiEndpoint || "https://api.anthropic.com/v1/messages";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) throw new Error(`API ${response.status}`);

    const data = await response.json();
    const assistantContent = data.content?.[0]?.text || "I'm sorry, I didn't quite catch that. Could you tell me more about what financing you need?";

    // Parse extracted data if present
    const extractedMatch = assistantContent.match(/<extracted>(.*?)<\/extracted>/s);
    let extractedData = { ...state.extractedData };
    let suggestedProduct = state.suggestedProduct;

    if (extractedMatch) {
      try {
        const parsed = JSON.parse(extractedMatch[1]);
        extractedData = { ...extractedData, ...parsed, confidence: 0.8 };

        // Find matching product
        if (parsed.loanAmount) {
          suggestedProduct = products.find(p =>
            p.status === "Active" &&
            parsed.loanAmount >= p.minAmount &&
            parsed.loanAmount <= p.maxAmount
          ) || null;

          if (suggestedProduct) {
            extractedData.recommendedProduct = suggestedProduct.id;
            extractedData.confidence = 0.9;
          }
        }
      } catch { /* ignore parse errors */ }
    }

    // Clean display content (remove extracted block)
    const displayContent = assistantContent.replace(/<extracted>.*?<\/extracted>/s, "").trim();

    // Determine conversation stage
    let stage = state.stage;
    if (extractedData.loanAmount && extractedData.purpose) stage = "needs";
    if (extractedData.businessName && extractedData.revenue) stage = "business";
    if (extractedData.recommendedProduct) stage = "product";
    if (extractedData.confidence >= 0.9) stage = "review";

    return {
      messages: [
        ...messages,
        { role: "assistant" as const, content: displayContent, timestamp: Date.now() },
      ],
      extractedData,
      stage,
      suggestedProduct,
      error: null,
    };
  } catch (err: any) {
    // Fallback: generate a helpful response without AI
    const fallbackResponse = generateFallbackResponse(state, userMessage);
    return {
      messages: [
        ...messages,
        { role: "assistant" as const, content: fallbackResponse, timestamp: Date.now() },
      ],
      extractedData: state.extractedData,
      stage: state.stage,
      suggestedProduct: state.suggestedProduct,
      error: `AI unavailable: ${err.message}. Using guided mode.`,
    };
  }
}

/**
 * Generate a basic response without AI (guided form fallback).
 */
function generateFallbackResponse(state: AssistantState, userMessage: string): string {
  switch (state.stage) {
    case "greeting":
      return "Thanks for your interest! How much financing are you looking for? (Please enter an amount in Rand, e.g. R500,000)";
    case "needs":
      return "Great. What will the funds be used for? (e.g. equipment, working capital, transport)";
    case "business":
      return "Could you tell me your business name and how many years you've been operating?";
    case "product":
      return "Thank you for all that information! Let me prepare your application. You can review and submit on the next screen.";
    default:
      return "Thank you. Let me process that information. Please continue to the application form to review and submit.";
  }
}

/**
 * Convert extracted conversation data into an application form object.
 */
export function extractedToAppForm(
  extracted: ExtractedAppData,
  product: Product | null,
  customer: Customer | null
): Record<string, any> {
  return {
    custId: customer?.id || "",
    product: extracted.recommendedProduct || product?.id || "",
    amount: extracted.loanAmount || 0,
    term: extracted.loanTerm || 12,
    purpose: extracted.purpose || "",
    // Pre-populate customer fields if creating new
    businessName: extracted.businessName || customer?.name || "",
    industry: extracted.industry || customer?.industry || "",
    revenue: extracted.revenue || customer?.revenue || 0,
    employees: extracted.employees || customer?.employees || 0,
    yearsInBusiness: extracted.yearsInBusiness || customer?.years || 0,
    beeLevel: extracted.beeLevel || customer?.beeLevel || 0,
  };
}

/**
 * Get document checklist based on product and BEE status.
 */
export function getRequiredDocuments(
  product: Product | null,
  beeLevel: number
): { type: string; label: string; mandatory: boolean; reason: string }[] {
  const docs = [
    { type: "sa_id", label: "SA ID Document", mandatory: true, reason: "FICA identity verification" },
    { type: "proof_of_address", label: "Proof of Address", mandatory: true, reason: "FICA address verification (municipal/utility bill, < 3 months)" },
    { type: "cipc", label: "Company Registration (CIPC)", mandatory: true, reason: "Business registration verification" },
    { type: "bank_confirm", label: "Bank Confirmation Letter", mandatory: true, reason: "Bank account ownership verification" },
    { type: "financials", label: "Financial Statements", mandatory: true, reason: "Credit assessment — income and affordability" },
    { type: "business_plan", label: "Business Plan", mandatory: true, reason: "Business viability assessment" },
  ];

  // Conditional documents
  if (beeLevel && beeLevel <= 4) {
    docs.push({ type: "bee_cert", label: "BEE Certificate", mandatory: true, reason: "Empowerment verification for preferential assessment" });
  } else {
    docs.push({ type: "bee_cert", label: "BEE Certificate", mandatory: false, reason: "Empowerment verification (optional but beneficial)" });
  }

  docs.push({ type: "tax_clearance", label: "Tax Clearance Certificate", mandatory: false, reason: "SARS compliance verification" });

  if (product?.repaymentType === "Amortising" && product.maxAmount > 500000) {
    docs.push({ type: "collateral", label: "Collateral Documentation", mandatory: true, reason: "Security for loans above R500,000" });
  }

  return docs;
}
