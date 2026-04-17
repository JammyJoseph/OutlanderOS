const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0'

interface XeroTokens {
  access_token: string
  refresh_token?: string
  id_token?: string
  token_type: string
  expires_in: number
  expires_at?: number
  [key: string]: any
}

async function refreshXeroTokens(tokens: XeroTokens): Promise<XeroTokens | null> {
  if (!tokens.refresh_token) return null

  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(
        `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
      ).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    }),
  })

  if (!res.ok) {
    console.error('Xero token refresh failed:', res.status, await res.text())
    return null
  }

  const newTokens = await res.json()
  return {
    ...tokens,
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token || tokens.refresh_token,
    id_token: newTokens.id_token || tokens.id_token,
    expires_at: Date.now() + (newTokens.expires_in * 1000),
  }
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

export async function getXeroAgedReceivables(tokens: XeroTokens, tenantId: string) {
  try {
    const data = await xeroFetch('/Reports/AgedReceivablesByContact', tokens, tenantId)
    return data.Reports?.[0] || null
  } catch (e) { console.error('Xero aged receivables error:', e); return null }
}

export async function getXeroAgedPayables(tokens: XeroTokens, tenantId: string) {
  try {
    const data = await xeroFetch('/Reports/AgedPayablesByContact', tokens, tenantId)
    return data.Reports?.[0] || null
  } catch (e) { console.error('Xero aged payables error:', e); return null }
}

export async function getXeroContacts(tokens: XeroTokens, tenantId: string) {
  try {
    const data = await xeroFetch('/Contacts?where=IsCustomer==true&order=Name', tokens, tenantId)
    return (data.Contacts || []).map((c: any) => ({
      contactId: c.ContactID,
      name: c.Name,
      email: c.EmailAddress || '',
      phone: c.Phones?.[0]?.PhoneNumber || '',
      outstandingBalance: c.Balances?.AccountsReceivable?.Outstanding || 0,
      overdueBalance: c.Balances?.AccountsReceivable?.Overdue || 0,
    }))
  } catch (e) { console.error('Xero contacts error:', e); return [] }
}

export async function getXeroBankTransactions(tokens: XeroTokens, tenantId: string) {
  try {
    const data = await xeroFetch('/BankTransactions?where=Type=="RECEIVE"&order=Date DESC&page=1', tokens, tenantId)
    return (data.BankTransactions || []).slice(0, 20).map((t: any) => ({
      date: t.DateString || t.Date || '',
      contact: t.Contact?.Name || '',
      total: t.Total,
      reference: t.Reference || '',
      status: t.Status,
      type: t.Type,
    }))
  } catch (e) { console.error('Xero bank transactions error:', e); return [] }
}

export async function fetchAllXeroData(tokenJson: string): Promise<{ data: any; updatedTokenJson?: string }> {
  try {
    let tokens = JSON.parse(tokenJson) as XeroTokens
    let updatedTokenJson: string | undefined

    const needsRefresh = !tokens.expires_at || Date.now() > (tokens.expires_at - 60000)
    if (needsRefresh && tokens.refresh_token) {
      const refreshed = await refreshXeroTokens(tokens)
      if (!refreshed) {
        return { data: { connected: false, error: 'Token expired — please reconnect Xero in Settings' } }
      }
      tokens = refreshed
      updatedTokenJson = JSON.stringify(tokens)
    }

    const connections = await getXeroConnections(tokens.access_token)
    if (!connections.length) return { data: { connected: false, error: 'No Xero organisations connected' } }
    const tenantId = connections[0].tenantId

    const [profitAndLoss, bankSummary, invoices, balanceSheet, agedReceivables, contacts, recentPayments] = await Promise.all([
      getXeroProfitAndLoss(tokens, tenantId),
      getXeroBankSummary(tokens, tenantId),
      getXeroInvoices(tokens, tenantId),
      getXeroBalanceSheet(tokens, tenantId),
      getXeroAgedReceivables(tokens, tenantId),
      getXeroContacts(tokens, tenantId),
      getXeroBankTransactions(tokens, tenantId),
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
      data: {
        connected: true,
        organisation: connections[0].tenantName,
        totalIncome,
        totalExpenses,
        netProfit,
        bankBalance,
        invoices,
        contacts,
        recentPayments,
        agedReceivablesRaw: agedReceivables,
        profitAndLossRaw: profitAndLoss,
        bankSummaryRaw: bankSummary,
      },
      updatedTokenJson,
    }
  } catch (error) {
    console.error('Failed to fetch Xero data:', error)
    return { data: { connected: false, error: String(error) } }
  }
}
