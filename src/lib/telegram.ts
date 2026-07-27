// Env-only. A live bot token and chat id used to sit here as fallbacks, in
// tracked source and in git history. Rotate at BotFather before reusing this.
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

export async function sendTelegramMessage(text: string, parseMode: string = 'HTML') {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID unset)')
    return false
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: parseMode,
      }),
    })
    const data = await res.json()
    if (!data.ok) console.error('Telegram send failed:', data)
    return data.ok
  } catch (e) {
    console.error('Telegram error:', e)
    return false
  }
}

export function formatInvoicePaid(client: string, amount: string, invoiceNum: string) {
  return `💰 <b>Payment Received</b>\n\nClient: ${client}\nAmount: ${amount}\nInvoice: ${invoiceNum}\n\n— OutlanderOS`
}

export function formatDealSigned(client: string, campaign: string, amount: string) {
  return `✅ <b>Deal Signed</b>\n\nClient: ${client}\nCampaign: ${campaign}\nValue: ${amount}\n\n— OutlanderOS`
}

export function formatInvoiceOverdue(client: string, amount: string, daysPast: number) {
  return `⚠️ <b>Invoice Overdue</b>\n\nClient: ${client}\nAmount: ${amount}\nDays overdue: ${daysPast}\n\n— OutlanderOS`
}

export function formatReminder(title: string, dueDate: string, category: string) {
  return `🔔 <b>Reminder</b>\n\n${title}\nDue: ${dueDate}\nCategory: ${category}\n\n— OutlanderOS`
}

export function formatSystemAlert(message: string) {
  return `🟢 <b>OutlanderOS</b>\n\n${message}`
}
