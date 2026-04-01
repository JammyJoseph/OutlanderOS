import { XeroClient } from 'xero-node'

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID!
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET!
const REDIRECT_URI = 'http://localhost:3000/api/xero/callback'
const SCOPES = 'openid profile email accounting.transactions accounting.contacts accounting.settings'

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

export async function getXeroBankSummary(tokenJson: string) {
  try {
    const xero = await getXeroClientWithToken(tokenJson)
    const tenantId = xero.tenants[0]?.tenantId
    if (!tenantId) throw new Error('No Xero tenant found')
    const accounts = await xero.accountingApi.getAccounts(tenantId, undefined, 'Type=="BANK"')
    return accounts.body.accounts?.map(a => ({
      name: a.name,
      code: a.code,
      balance: a.reportingCode,
    })) ?? []
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
