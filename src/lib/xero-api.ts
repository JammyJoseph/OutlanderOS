const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0'

interface XeroTokens {
  access_token: string
  refresh_token?: string
  id_token?: string
  token_type: string
  expires_in: number
  [key: string]: any
}

async function xeroFetch(endpoint: string, tokens: XeroTokens, tenantId: string) {
  const res = await fetch(`${XERO_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Xero-Tenant-Id': tenantId,
      'Accept': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Xero API ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function getXeroConnections(accessToken: string) {
  const res = await fetch('https://api.xero.com/connections', {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`Connections ${res.status}`)
  return res.json()
}

export async function getXeroProfitAndLoss(tokens: XeroTokens, tenantId: string) {
  try {
    const data = await xeroFetch('/Reports/ProfitAndLoss', tokens, tenantId)
    return data.Reports?.[0] || null
  } catch (e) { console.error('Xero P&L error:', e); return null }
}

export async function getXeroBankSummary(tokens: XeroTokens, tenantId: string) {
  try {
    const data = await xeroFetch('/Reports/BankSummary', tokens, tenantId)
    return data.Reports?.[0] || null
  } catch (e) { console.error('Xero bank summary error:', e); return null }
}

export async function getXeroInvoices(tokens: XeroTokens, tenantId: string) {
  try {
    const data = await xeroFetch('/Invoices?Statuses=AUTHORISED,OVERDUE&order=DueDate', tokens, tenantId)
    return (data.Invoices || []).slice(0, 20).map((inv: any) => ({
      invoiceNumber: inv.InvoiceNumber,
      contact: inv.Contact?.Name || '',
      total: inv.Total,
      amountDue: inv.AmountDue,
      dueDate: inv.DueDateString || inv.DueDate || '',
      status: inv.Status,
      type: inv.Type,
    }))
  } catch (e) { console.error('Xero invoices error:', e); return [] }
}

export async function getXeroBalanceSheet(tokens: XeroTokens, tenantId: string) {
  try {
    const data = await xeroFetch('/Reports/BalanceSheet', tokens, tenantId)
    return data.Reports?.[0] || null
  } catch (e) { console.error('Xero balance sheet error:', e); return null }
}

export async function fetchAllXeroData(tokenJson: string) {
  try {
    const tokens = JSON.parse(tokenJson) as XeroTokens
    const connections = await getXeroConnections(tokens.access_token)
    if (!connections.length) return { error: 'No Xero organisations connected' }
    const tenantId = connections[0].tenantId

    const [profitAndLoss, bankSummary, invoices, balanceSheet] = await Promise.all([
      getXeroProfitAndLoss(tokens, tenantId),
      getXeroBankSummary(tokens, tenantId),
      getXeroInvoices(tokens, tenantId),
      getXeroBalanceSheet(tokens, tenantId),
    ])

    // Extract key numbers from P&L report
    let totalIncome = 0, totalExpenses = 0, netProfit = 0
    if (profitAndLoss?.Rows) {
      for (const section of profitAndLoss.Rows) {
        const title = (section.Title || '').toLowerCase()
        if (section.RowType === 'Section') {
          for (const row of section.Rows || []) {
            if (row.RowType === 'SummaryRow' && row.Cells) {
              const val = parseFloat(row.Cells[row.Cells.length - 1]?.Value || '0')
              if (title.includes('income') || title.includes('revenue')) totalIncome = val
              else if (title.includes('expense') || title.includes('cost')) totalExpenses = Math.abs(val)
            }
          }
        }
      }
      netProfit = totalIncome - totalExpenses
    }

    // Extract bank balance
    let bankBalance = 0
    if (bankSummary?.Rows) {
      for (const section of bankSummary.Rows) {
        if (section.RowType === 'Section') {
          for (const row of section.Rows || []) {
            if (row.RowType === 'SummaryRow' && row.Cells) {
              bankBalance = parseFloat(row.Cells[row.Cells.length - 1]?.Value || '0')
            }
          }
        }
      }
    }

    void balanceSheet

    return {
      connected: true,
      organisation: connections[0].tenantName,
      totalIncome,
      totalExpenses,
      netProfit,
      bankBalance,
      invoices,
      profitAndLossRaw: profitAndLoss,
      bankSummaryRaw: bankSummary,
    }
  } catch (error) {
    console.error('Failed to fetch Xero data:', error)
    return { connected: false, error: String(error) }
  }
}
