import { XeroClient } from 'xero-node'

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID!
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET!
const REDIRECT_URI = 'http://localhost:3000/api/xero/callback'
const SCOPES = 'openid profile email offline_access accounting.invoices.read accounting.payments.read accounting.banktransactions.read accounting.contacts.read accounting.settings.read accounting.reports.profitandloss.read accounting.reports.balancesheet.read accounting.reports.banksummary.read accounting.reports.aged.read'

export function createXeroClient() {
  return new XeroClient({
    clientId: XERO_CLIENT_ID,
    clientSecret: XERO_CLIENT_SECRET,
    redirectUris: [REDIRECT_URI],
    scopes: SCOPES.split(' '),
  })
}

export async function getXeroAuthUrl(): Promise<string> {
  const xero = createXeroClient()
  const url = await xero.buildConsentUrl()
  return url
}

export async function handleXeroCallback(code: string): Promise<string> {
  const xero = createXeroClient()
  const tokenSet = await xero.apiCallback(`${REDIRECT_URI}?code=${code}`)
  return JSON.stringify(tokenSet)
}

export async function getXeroClientWithToken(tokenJson: string) {
  const xero = createXeroClient()
  const tokenSet = JSON.parse(tokenJson)
  await xero.setTokenSet(tokenSet)
  await xero.updateTenants()
  return xero
}

export async function refreshXeroToken(tokenJson: string): Promise<string> {
  const xero = createXeroClient()
  const tokenSet = JSON.parse(tokenJson)
  await xero.setTokenSet(tokenSet)
  const refreshed = await xero.refreshToken()
  return JSON.stringify(refreshed)
}

export async function getXeroOrganisation(tokenJson: string) {
  try {
    const xero = await getXeroClientWithToken(tokenJson)
    const tenantId = xero.tenants[0]?.tenantId
    if (!tenantId) throw new Error('No Xero tenant found')
    const orgs = await xero.accountingApi.getOrganisations(tenantId)
    return orgs.body.organisations?.[0] ?? null
  } catch (err) {
    console.error('getXeroOrganisation:', err)
    return null
  }
}

export async function getXeroProfitAndLoss(tokenJson: string) {
  try {
    const xero = await getXeroClientWithToken(tokenJson)
    const tenantId = xero.tenants[0]?.tenantId
    if (!tenantId) throw new Error('No Xero tenant found')
    const fromDate = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    const toDate = new Date().toISOString().split('T')[0]
    const report = await xero.accountingApi.getReportProfitAndLoss(
      tenantId,
      fromDate,
      toDate
    )
    const rows = report.body.reports?.[0]?.rows ?? []

    let totalIncome = 0
    let totalExpenses = 0
    let netProfit = 0

    for (const section of rows) {
      const title = section.title?.toLowerCase() ?? ''
      const cells = section.rows?.flatMap(r => r.cells ?? []) ?? []
      const lastCell = (row: { cells?: Array<{ value?: string }> }) => {
        const c = row.cells ?? []
        return parseFloat(c[c.length - 1]?.value ?? '0') || 0
      }
      if (title.includes('income') || title.includes('revenue')) {
        for (const row of section.rows ?? []) {
          if (String(row.rowType) === 'SummaryRow') totalIncome = lastCell(row)
        }
      } else if (title.includes('expense') || title.includes('cost')) {
        for (const row of section.rows ?? []) {
          if (String(row.rowType) === 'SummaryRow') totalExpenses = lastCell(row)
        }
      } else if (title.includes('profit') || title.includes('net')) {
        for (const row of section.rows ?? []) {
          if (String(row.rowType) === 'SummaryRow') netProfit = lastCell(row)
        }
      }
      void cells
    }

    return { totalIncome, totalExpenses, netProfit }
  } catch (err) {
    console.error('getXeroProfitAndLoss:', err)
    return null
  }
}

export async function getXeroBankSummary(tokenJson: string): Promise<Array<{ name: string; balance: number }>> {
  try {
    const xero = await getXeroClientWithToken(tokenJson)
    const tenantId = xero.tenants[0]?.tenantId
    if (!tenantId) throw new Error('No Xero tenant found')
    const accessToken = JSON.parse(tokenJson).access_token as string

    const res = await fetch('https://api.xero.com/api.xro/2.0/Reports/BankSummary', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'xero-tenant-id': tenantId,
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`BankSummary HTTP ${res.status}`)
    const json = await res.json() as {
      Reports?: Array<{
        Rows?: Array<{
          RowType?: string
          Rows?: Array<{ RowType?: string; Cells?: Array<{ Value?: string }> }>
          Cells?: Array<{ Value?: string }>
        }>
      }>
    }

    const rows = json.Reports?.[0]?.Rows ?? []
    const results: Array<{ name: string; balance: number }> = []

    for (const section of rows) {
      for (const row of section.Rows ?? []) {
        if (row.RowType === 'Row' && row.Cells && row.Cells.length >= 2) {
          const name = row.Cells[0]?.Value ?? ''
          // Last cell is the closing balance
          const balanceStr = row.Cells[row.Cells.length - 1]?.Value ?? '0'
          const balance = parseFloat(balanceStr.replace(/[^0-9.-]/g, '')) || 0
          if (name && name !== 'Total') results.push({ name, balance })
        }
      }
    }

    return results
  } catch (err) {
    console.error('getXeroBankSummary:', err)
    return []
  }
}

export async function getXeroInvoices(tokenJson: string, type: 'ACCREC' | 'ACCPAY' = 'ACCPAY') {
  try {
    const xero = await getXeroClientWithToken(tokenJson)
    const tenantId = xero.tenants[0]?.tenantId
    if (!tenantId) throw new Error('No Xero tenant found')
    const invoices = await xero.accountingApi.getInvoices(
      tenantId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [type as Parameters<typeof xero.accountingApi.getInvoices>[7] extends Array<infer T> ? T : never],
      undefined,
      undefined,
      undefined,
      10,
      undefined,
      undefined
    )
    return invoices.body.invoices?.map(inv => ({
      invoiceNumber: inv.invoiceNumber,
      contact: inv.contact?.name,
      total: inv.total,
      amountDue: inv.amountDue,
      dueDate: String(inv.dueDate || ""),
      status: inv.status,
      currency: String(inv.currencyCode || ""),
    })) ?? []
  } catch (err) {
    console.error('getXeroInvoices:', err)
    return []
  }
}

export async function getXeroAgedReceivables(tokenJson: string): Promise<Array<{
  contact: string
  total: number
  current: number
  overdue30: number
  overdue60: number
  overdue90: number
}>> {
  try {
    const xero = await getXeroClientWithToken(tokenJson)
    const tenantId = xero.tenants[0]?.tenantId
    if (!tenantId) throw new Error('No Xero tenant found')
    const accessToken = JSON.parse(tokenJson).access_token as string

    const toDate = new Date().toISOString().split('T')[0]
    const url = `https://api.xero.com/api.xro/2.0/Reports/AgedReceivablesByContact?Date=${toDate}&fromDate=2020-01-01&toDate=${toDate}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'xero-tenant-id': tenantId,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      // Fall back to computing from outstanding invoices
      const invoices = await xero.accountingApi.getInvoices(
        tenantId,
        undefined, undefined, undefined, undefined, undefined, undefined,
        ['ACCREC' as Parameters<typeof xero.accountingApi.getInvoices>[7] extends Array<infer T> ? T : never],
        undefined, undefined, undefined, 50, undefined, undefined
      )
      const today = new Date()
      const byContact: Record<string, { contact: string; total: number; current: number; overdue30: number; overdue60: number; overdue90: number }> = {}

      for (const inv of invoices.body.invoices ?? []) {
        if (!inv.amountDue || inv.amountDue <= 0) continue
        const contact = inv.contact?.name ?? 'Unknown'
        if (!byContact[contact]) byContact[contact] = { contact, total: 0, current: 0, overdue30: 0, overdue60: 0, overdue90: 0 }
        byContact[contact].total += inv.amountDue
        const dueDate = inv.dueDate ? new Date(inv.dueDate) : today
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000))
        if (daysOverdue === 0) byContact[contact].current += inv.amountDue
        else if (daysOverdue <= 30) byContact[contact].overdue30 += inv.amountDue
        else if (daysOverdue <= 60) byContact[contact].overdue60 += inv.amountDue
        else byContact[contact].overdue90 += inv.amountDue
      }

      return Object.values(byContact).filter(c => c.total > 0).sort((a, b) => b.total - a.total)
    }

    // Parse the aged receivables report
    const json = await res.json() as {
      Reports?: Array<{
        Rows?: Array<{
          RowType?: string
          Rows?: Array<{ RowType?: string; Cells?: Array<{ Value?: string }> }>
          Cells?: Array<{ Value?: string }>
        }>
      }>
    }

    const rows = json.Reports?.[0]?.Rows ?? []
    const results: Array<{ contact: string; total: number; current: number; overdue30: number; overdue60: number; overdue90: number }> = []

    for (const section of rows) {
      for (const row of section.Rows ?? []) {
        if (row.RowType === 'Row' && row.Cells && row.Cells.length >= 5) {
          const contact = row.Cells[0]?.Value ?? ''
          const p = (i: number) => parseFloat(row.Cells?.[i]?.Value?.replace(/[^0-9.-]/g, '') ?? '0') || 0
          const total = p(row.Cells.length - 1)
          if (contact && total > 0) {
            results.push({ contact, current: p(1), overdue30: p(2), overdue60: p(3), overdue90: p(4), total })
          }
        }
      }
    }

    return results.sort((a, b) => b.total - a.total)
  } catch (err) {
    console.error('getXeroAgedReceivables:', err)
    return []
  }
}

export async function getXeroContacts(tokenJson: string) {
  try {
    const xero = await getXeroClientWithToken(tokenJson)
    const tenantId = xero.tenants[0]?.tenantId
    if (!tenantId) throw new Error('No Xero tenant found')
    const contacts = await xero.accountingApi.getContacts(
      tenantId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      10
    )
    return contacts.body.contacts?.map(c => ({
      name: c.name,
      email: c.emailAddress,
      phone: c.phones?.[0]?.phoneNumber,
    })) ?? []
  } catch (err) {
    console.error('getXeroContacts:', err)
    return []
  }
}
