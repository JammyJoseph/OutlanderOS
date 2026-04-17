import Anthropic from '@anthropic-ai/sdk'
import { getChatHistory, getLearnedFacts } from './chat-memory'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Static preamble — cached across requests
const STATIC_SYSTEM = `You are Operations, the CEO agent of OutlanderOS — the internal operating system for Outlander Magazine, a UK fashion and culture media company.

TEAM: Joe Silver (Ops), Quinn Titsworth (CEO), Shreeya Patel (Sales), Callum (Content), Patricia (Production)

RULES:
- You are Operations, the CEO agent. You coordinate all other agents.
- When asked about finances, delegate to the Finance agent.
- When asked about emails/billing inbox, delegate to the Email agent.
- When asked about production/shoots, delegate to the Production agent.
- When asked about sales/pipeline/deals, delegate to the Sales agent.
- When asked about content/Instagram, delegate to the Content agent.
- Always reference REAL data from the context provided. Never make up numbers.
- Be concise and actionable. Use £ GBP for all currency.
- Format responses clearly with bullet points for lists.`

export interface AgentResponse {
  operationsMessage: string
  delegatedTo?: string
  delegatedMessage?: string
}

export async function processAgentMessage(userMessage: string, dashboardData: any): Promise<AgentResponse> {
  let dataContext = 'REAL BUSINESS DATA:\n\n'

  if (dashboardData?.billingTracker) {
    dataContext += `BILLING TRACKER:
- Booked Revenue YTD: ${dashboardData.billingTracker.bookedRevenue || 'Unknown'}
- Gap to Target: ${dashboardData.billingTracker.gapToTarget || 'Unknown'}
- Total Deals: ${dashboardData.billingTracker.totalDeals || 0}
- Quarterly Totals: Q1 £${dashboardData.billingTracker.quarterlyTotals?.q1 || 0}, Q2 £${dashboardData.billingTracker.quarterlyTotals?.q2 || 0}, Q3 £${dashboardData.billingTracker.quarterlyTotals?.q3 || 0}, Q4 £${dashboardData.billingTracker.quarterlyTotals?.q4 || 0}

DEALS:
${(dashboardData.billingTracker.deals || []).slice(0, 20).map((d: any) => `- ${d.client}: ${d.campaign} | IO ${d.ioNumber} | £${d.annualTotal} | Margin ${d.margin} | Signed: ${d.signed ? 'Yes' : 'No'} | Invoice Sent: ${d.invoiceSent ? 'Yes' : 'No'}`).join('\n')}

`
  }

  if (dashboardData?.xero?.connected) {
    dataContext += `XERO FINANCIALS:
- Total Income: £${dashboardData.xero.totalIncome?.toLocaleString() || 0}
- Total Expenses: £${dashboardData.xero.totalExpenses?.toLocaleString() || 0}
- Net Profit: £${dashboardData.xero.netProfit?.toLocaleString() || 0}
- Bank Balance: £${dashboardData.xero.bankBalance?.toLocaleString() || 0}

OUTSTANDING INVOICES:
${(dashboardData.xero.invoices || []).filter((i: any) => i.amountDue > 0).map((i: any) => `- ${i.contact}: £${i.amountDue} due ${i.dueDate} (${i.status})`).join('\n') || 'None'}

`
  }

  if (dashboardData?.billingAlerts?.length > 0) {
    dataContext += `BILLING ALERTS (from billing@ email):
${dashboardData.billingAlerts.slice(0, 10).map((a: any) => `- [${a.priority.toUpperCase()}] ${a.client}: ${a.subject}`).join('\n')}

`
  }

  // Build memory context from persistent chat history
  const history = getChatHistory(10)
  const facts = getLearnedFacts()

  let memoryContext = ''
  if (history.length > 0) {
    memoryContext += 'CONVERSATION HISTORY (last messages):\n'
    memoryContext += history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
    memoryContext += '\n\n'
  }
  if (facts.length > 0) {
    memoryContext += 'LEARNED FACTS ABOUT THIS BUSINESS:\n'
    memoryContext += facts.map(f => `- ${f}`).join('\n')
    memoryContext += '\n\n'
  }
  memoryContext += `INSTRUCTIONS:
- If the user tells you something new about the business (a decision, a preference, a fact), remember it.
- Reference previous conversations when relevant.
- You have persistent memory across sessions.`

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: STATIC_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: dataContext,
        },
        {
          type: 'text',
          text: memoryContext,
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    const delegationPatterns = [
      { pattern: /finance|invoice|payment|revenue|budget|margin|xero|cash/i, agent: 'Finance' },
      { pattern: /email|inbox|billing@|chase|follow.?up/i, agent: 'Email' },
      { pattern: /production|shoot|crew|studio|schedule/i, agent: 'Production' },
      { pattern: /sales|pipeline|deal|pitch|renewal|client/i, agent: 'Sales' },
      { pattern: /content|instagram|post|engagement|social/i, agent: 'Content' },
    ]

    let delegatedTo: string | undefined
    for (const { pattern, agent } of delegationPatterns) {
      if (pattern.test(userMessage)) {
        delegatedTo = agent
        break
      }
    }

    return {
      operationsMessage: text,
      delegatedTo,
      delegatedMessage: delegatedTo ? text : undefined,
    }
  } catch (error) {
    console.error('Claude API error:', error)
    return {
      operationsMessage: `I couldn't process that right now. Error: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure ANTHROPIC_API_KEY is configured in the server environment.`,
    }
  }
}
