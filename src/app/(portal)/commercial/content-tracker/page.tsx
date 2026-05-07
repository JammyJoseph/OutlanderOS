'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react'
import { Heart, MessageCircle, Bookmark, Share2, Eye, TrendingUp, ChevronDown, X, RefreshCw, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type PostType = 'Post' | 'Reel' | 'Carousel' | 'Story'
type FilterRange = 'this_month' | 'last_month' | 'last_3_months' | 'all'
type FilterType = 'All' | 'Posts' | 'Reels' | 'Carousels'
type FilterPerf = 'All' | 'Above Average' | 'Below Average'

interface ApiMedia {
  id: string
  caption?: string
  media_type: string
  media_product_type?: string
  media_url?: string
  thumbnail_url?: string
  timestamp: string
  permalink: string
  like_count: number
  comments_count: number
  classified_type: PostType
}

interface ApiProfile {
  id: string
  username: string
  name?: string
  profile_picture_url?: string
  followers_count: number
  media_count: number
}

interface PostInsights {
  reach: number
  saved: number
  shares: number
  total_interactions: number
  views?: number
  loaded: boolean
  error?: string
}

interface Post extends ApiMedia {
  type: PostType
  date: string
  thumbnail: string
  insights: PostInsights
  campaignId: string | null
}

interface TrelloCampaign {
  id: string
  name: string
}

const TYPE_COLORS: Record<PostType, string> = {
  Post: 'bg-blue-50 text-blue-700',
  Reel: 'bg-purple-50 text-purple-700',
  Carousel: 'bg-indigo-50 text-indigo-700',
  Story: 'bg-pink-50 text-pink-700',
}

const ASSIGNMENT_KEY = 'ig-content-tracker-assignments-v1'

function loadAssignments(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(ASSIGNMENT_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveAssignments(map: Record<string, string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function fmt(n: number) {
  if (!Number.isFinite(n) || n === 0) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

function engagementRate(p: Post, followers: number): number {
  if (!followers) return 0
  const interactions =
    p.insights.total_interactions ||
    p.like_count + p.comments_count + p.insights.saved + p.insights.shares
  return parseFloat(((interactions / followers) * 100).toFixed(2))
}

function inRange(dateStr: string, range: FilterRange): boolean {
  if (range === 'all') return true
  const d = new Date(dateStr)
  const now = new Date()
  if (range === 'this_month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }
  if (range === 'last_month') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth()
  }
  if (range === 'last_3_months') {
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    return d >= cutoff
  }
  return true
}

export default function ContentTrackerPage() {
  const [profile, setProfile] = useState<ApiProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [campaigns, setCampaigns] = useState<TrelloCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [filterRange, setFilterRange] = useState<FilterRange>('last_3_months')
  const [filterType, setFilterType] = useState<FilterType>('All')
  const [filterPerf, setFilterPerf] = useState<FilterPerf>('All')
  const [filterCampaign, setFilterCampaign] = useState<string>('All')
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [expandedPost, setExpandedPost] = useState<string | null>(null)

  async function loadAll() {
    setError(null)
    setLoading(prev => prev || posts.length === 0)
    try {
      const assignments = loadAssignments()
      const [profileRes, mediaRes, trelloRes] = await Promise.all([
        fetch('/api/instagram/profile').then(r => r.ok ? r.json() : Promise.reject(r)),
        fetch('/api/instagram/media?limit=50').then(r => r.ok ? r.json() : Promise.reject(r)),
        fetch('/api/trello').then(r => r.ok ? r.json() : null).catch(() => null),
      ])

      setProfile(profileRes)

      const items: Post[] = (mediaRes.data ?? []).map((m: ApiMedia) => ({
        ...m,
        type: m.classified_type,
        date: m.timestamp,
        thumbnail: m.thumbnail_url || m.media_url || '',
        insights: { reach: 0, saved: 0, shares: 0, total_interactions: 0, loaded: false },
        campaignId: assignments[m.id] ?? null,
      }))
      setPosts(items)

      if (trelloRes?.stages) {
        type TrelloStage = { id: string; name: string; cards: Array<{ id: string; name: string; client?: string }> }
        const cs: TrelloCampaign[] = []
        for (const stage of (trelloRes.stages as TrelloStage[])) {
          for (const card of stage.cards) {
            cs.push({ id: card.id, name: card.client ? `${card.client} — ${card.name}` : card.name })
          }
        }
        setCampaigns(cs)
      }

      // Fetch insights in parallel for posts that aren't Stories (story insights are time-bound)
      const insightTargets = items.filter(p => p.type !== 'Story').slice(0, 30)
      const insightResults = await Promise.allSettled(
        insightTargets.map(p =>
          fetch(`/api/instagram/media/${p.id}/insights?media_type=${p.media_type}`)
            .then(r => r.ok ? r.json() : Promise.reject(r))
        )
      )
      setPosts(prev => prev.map(p => {
        const idx = insightTargets.findIndex(t => t.id === p.id)
        if (idx === -1) return p
        const r = insightResults[idx]
        if (r.status === 'fulfilled') {
          return {
            ...p,
            insights: {
              reach: r.value.reach ?? 0,
              saved: r.value.saved ?? 0,
              shares: r.value.shares ?? 0,
              total_interactions: r.value.total_interactions ?? 0,
              views: r.value.views,
              loaded: true,
            },
          }
        }
        return { ...p, insights: { ...p.insights, loaded: true, error: 'Failed' } }
      }))
    } catch (err) {
      console.error(err)
      let message = 'Failed to load Instagram data'
      if (err instanceof Response) {
        try {
          const body = await err.json()
          message = body.error || message
        } catch {
          message = `${err.status} ${err.statusText}`
        }
      } else if (err instanceof Error) {
        message = err.message
      }
      setError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function refresh() {
    setRefreshing(true)
    loadAll()
  }

  function assignCampaign(postId: string, campaignId: string | null) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, campaignId } : p))
    const next = { ...loadAssignments() }
    if (campaignId) next[postId] = campaignId
    else delete next[postId]
    saveAssignments(next)
    setOpenDropdown(null)
  }

  const followers = profile?.followers_count ?? 0

  const avg = useMemo(() => {
    const loaded = posts.filter(p => p.insights.loaded)
    if (loaded.length === 0) {
      return { likes: 0, comments: 0, saves: 0, reach: 0, engagement: 0 }
    }
    const total = loaded.reduce((acc, p) => {
      const er = engagementRate(p, followers)
      return {
        likes: acc.likes + p.like_count,
        comments: acc.comments + p.comments_count,
        saves: acc.saves + p.insights.saved,
        reach: acc.reach + p.insights.reach,
        engagement: acc.engagement + er,
      }
    }, { likes: 0, comments: 0, saves: 0, reach: 0, engagement: 0 })
    return {
      likes: Math.round(total.likes / loaded.length),
      comments: Math.round(total.comments / loaded.length),
      saves: Math.round(total.saves / loaded.length),
      reach: Math.round(total.reach / loaded.length),
      engagement: parseFloat((total.engagement / loaded.length).toFixed(2)),
    }
  }, [posts, followers])

  const filtered = useMemo(() => {
    return posts.filter(p => {
      if (!inRange(p.date, filterRange)) return false
      if (filterType !== 'All') {
        const map: Record<FilterType, PostType | null> = { All: null, Posts: 'Post', Reels: 'Reel', Carousels: 'Carousel' }
        const want = map[filterType]
        if (want && p.type !== want) return false
      }
      const er = engagementRate(p, followers)
      if (filterPerf === 'Above Average' && er < avg.engagement) return false
      if (filterPerf === 'Below Average' && er >= avg.engagement) return false
      if (filterCampaign === 'Unassigned' && p.campaignId !== null) return false
      if (filterCampaign !== 'All' && filterCampaign !== 'Unassigned' && p.campaignId !== filterCampaign) return false
      return true
    })
  }, [posts, filterRange, filterType, filterPerf, filterCampaign, followers, avg.engagement])

  const campaignPosts = useMemo(
    () => selectedCampaign ? posts.filter(p => p.campaignId === selectedCampaign) : [],
    [posts, selectedCampaign]
  )
  const campaignData = selectedCampaign ? campaigns.find(c => c.id === selectedCampaign) : null
  const campaignTotalReach = campaignPosts.reduce((s, p) => s + p.insights.reach, 0)
  const campaignTotalLikes = campaignPosts.reduce((s, p) => s + p.like_count, 0)
  const campaignAvgEngagement = campaignPosts.length
    ? parseFloat((campaignPosts.reduce((s, p) => s + engagementRate(p, followers), 0) / campaignPosts.length).toFixed(2))
    : 0

  const expanded = expandedPost ? posts.find(p => p.id === expandedPost) : null

  return (
    <div className="flex flex-col h-full bg-gray-50 font-[family-name:var(--font-manrope,sans-serif)]">
      {/* Status bar */}
      {error ? (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
          <span className="text-xs text-red-800 font-medium">Instagram API error</span>
          <span className="text-xs text-red-700 truncate">— {error}</span>
          <button onClick={refresh} className="ml-auto text-xs text-red-700 underline hover:text-red-900">Retry</button>
        </div>
      ) : null}

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Account overview */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-3 mb-4">
              {profile?.profile_picture_url ? (
                <img src={profile.profile_picture_url} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-100" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm">
                  {profile?.username?.[0]?.toUpperCase() ?? 'O'}
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">
                  {profile ? `@${profile.username}` : (loading ? 'Loading…' : 'Not connected')}
                </p>
                <p className="text-xs text-gray-500">
                  {profile
                    ? `${fmt(profile.followers_count)} followers · ${profile.media_count} posts`
                    : (loading ? 'Fetching account…' : '—')}
                </p>
              </div>
              <button
                onClick={refresh}
                disabled={refreshing || loading}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Avg Likes', value: fmt(avg.likes), icon: Heart },
                { label: 'Avg Comments', value: fmt(avg.comments), icon: MessageCircle },
                { label: 'Avg Saves', value: fmt(avg.saves), icon: Bookmark },
                { label: 'Avg Reach', value: fmt(avg.reach), icon: Eye },
                { label: 'Avg Engagement', value: avg.engagement + '%', icon: TrendingUp },
              ].map(stat => (
                <div key={stat.label} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <stat.icon className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">{stat.label}</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 font-mono">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Filter bar */}
          <div className="px-6 py-3 border-b border-gray-200 bg-white flex items-center gap-3 flex-wrap">
            <select value={filterRange} onChange={e => setFilterRange(e.target.value as FilterRange)}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D4A853]">
              <option value="this_month">This month</option>
              <option value="last_month">Last month</option>
              <option value="last_3_months">Last 3 months</option>
              <option value="all">All time</option>
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value as FilterType)}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D4A853]">
              <option>All</option>
              <option>Posts</option>
              <option>Reels</option>
              <option>Carousels</option>
            </select>
            <select value={filterPerf} onChange={e => setFilterPerf(e.target.value as FilterPerf)}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D4A853]">
              <option>All</option>
              <option>Above Average</option>
              <option>Below Average</option>
            </select>
            <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D4A853]">
              <option value="All">All campaigns</option>
              <option value="Unassigned">Unassigned</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="ml-auto text-xs text-gray-400">{filtered.length} posts</span>
          </div>

          {/* Post grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-xs text-gray-400 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Loading Instagram posts…
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-gray-400">No posts match the current filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {filtered.map(post => {
                  const er = engagementRate(post, followers)
                  const aboveAvg = avg.engagement > 0 && er >= avg.engagement
                  const assigned = campaigns.find(c => c.id === post.campaignId)
                  return (
                    <div key={post.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                      {/* Thumbnail */}
                      <button
                        onClick={() => setExpandedPost(post.id)}
                        className="aspect-square bg-gray-100 relative group overflow-hidden">
                        {post.thumbnail ? (
                          <img src={post.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">{post.type}</div>
                        )}
                        <span className={cn('absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full', TYPE_COLORS[post.type])}>
                          {post.type}
                        </span>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </button>

                      <div className="p-3 space-y-2 flex-1 flex flex-col">
                        {/* Date + caption */}
                        <div>
                          <p className="text-[10px] text-gray-400">
                            {new Date(post.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-xs text-gray-700 line-clamp-2 mt-0.5 leading-snug">{post.caption || '—'}</p>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                          <div className="flex items-center gap-1 text-gray-600"><Heart className="w-3 h-3 text-rose-400" />{fmt(post.like_count)}</div>
                          <div className="flex items-center gap-1 text-gray-600"><MessageCircle className="w-3 h-3 text-blue-400" />{fmt(post.comments_count)}</div>
                          <div className="flex items-center gap-1 text-gray-600"><Bookmark className="w-3 h-3 text-amber-400" />{fmt(post.insights.saved)}</div>
                          <div className="flex items-center gap-1 text-gray-600"><Share2 className="w-3 h-3 text-green-400" />{fmt(post.insights.shares)}</div>
                          <div className="flex items-center gap-1 text-gray-600 col-span-2"><Eye className="w-3 h-3 text-purple-400" />{fmt(post.insights.reach)} reach</div>
                        </div>

                        {/* Engagement rate badge */}
                        <div className="flex items-center justify-between">
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                            !post.insights.loaded ? 'bg-gray-100 text-gray-400' :
                            aboveAvg ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
                            {post.insights.loaded ? `${er}% eng.` : '…'}
                          </span>
                        </div>

                        {/* Campaign assignment */}
                        <div className="mt-auto">
                          {assigned ? (
                            <div className="flex items-center gap-1">
                              <span className="flex-1 text-[10px] bg-amber-50 text-amber-700 rounded-full px-2 py-0.5 truncate">{assigned.name}</span>
                              <button onClick={() => assignCampaign(post.id, null)} className="text-gray-300 hover:text-gray-500 transition-colors">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="relative">
                              <button
                                onClick={() => setOpenDropdown(openDropdown === post.id ? null : post.id)}
                                className="w-full flex items-center justify-between text-[10px] border border-gray-200 rounded-lg px-2 py-1 text-gray-500 hover:border-amber-300 hover:text-gray-700 transition-colors">
                                {campaigns.length === 0 ? 'No campaigns' : 'Add to campaign'} <ChevronDown className="w-3 h-3" />
                              </button>
                              {openDropdown === post.id && campaigns.length > 0 && (
                                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 max-h-56 overflow-y-auto">
                                  {campaigns.map(c => (
                                    <button key={c.id} onClick={() => assignCampaign(post.id, c.id)}
                                      className="w-full text-left px-3 py-1.5 text-[10px] text-gray-700 hover:bg-amber-50 hover:text-amber-800 transition-colors">
                                      {c.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Campaign sidebar */}
        <div className="w-72 border-l border-gray-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Campaign Performance</p>
            <select value={selectedCampaign ?? ''} onChange={e => setSelectedCampaign(e.target.value || null)}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D4A853]">
              <option value="">Select a campaign…</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {selectedCampaign && campaignData ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-gray-900">{campaignData.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{campaignPosts.length} posts assigned</p>
              </div>

              <div className="space-y-2">
                {[
                  { label: 'Total Reach', value: fmt(campaignTotalReach) },
                  { label: 'Total Likes', value: fmt(campaignTotalLikes) },
                  { label: 'Avg Engagement', value: campaignAvgEngagement + '%' },
                ].map(m => (
                  <div key={m.label} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-xs text-gray-500">{m.label}</span>
                    <span className="text-sm font-semibold font-mono text-gray-900">{m.value}</span>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">vs Account Average</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Engagement rate</span>
                  <span className={cn('text-xs font-semibold', campaignAvgEngagement >= avg.engagement ? 'text-green-600' : 'text-red-500')}>
                    {campaignAvgEngagement >= avg.engagement ? '+' : ''}{(campaignAvgEngagement - avg.engagement).toFixed(2)}%
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Posts</p>
                <div className="space-y-2">
                  {campaignPosts.map(p => (
                    <div key={p.id} className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-md bg-gray-100 shrink-0 overflow-hidden">
                        {p.thumbnail ? <img src={p.thumbnail} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px] text-gray-400">{p.type[0]}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-700 truncate">{p.caption || '—'}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{engagementRate(p, followers)}% · {fmt(p.insights.reach)} reach</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-xs text-gray-400 text-center">Select a campaign to view aggregated performance</p>
            </div>
          )}
        </div>
      </div>

      {/* Expanded post modal */}
      {expanded ? (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6"
          onClick={() => setExpandedPost(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-400">
                  {new Date(expanded.date).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{expanded.type}</p>
              </div>
              <button onClick={() => setExpandedPost(null)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-0 overflow-hidden flex-1">
              <div className="bg-gray-100 flex items-center justify-center overflow-hidden">
                {expanded.thumbnail ? (
                  <img src={expanded.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-400">{expanded.type}</span>
                )}
              </div>
              <div className="p-5 overflow-y-auto space-y-4">
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{expanded.caption || '—'}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: 'Likes', value: fmt(expanded.like_count) },
                    { label: 'Comments', value: fmt(expanded.comments_count) },
                    { label: 'Saves', value: fmt(expanded.insights.saved) },
                    { label: 'Shares', value: fmt(expanded.insights.shares) },
                    { label: 'Reach', value: fmt(expanded.insights.reach) },
                    { label: 'Total Interactions', value: fmt(expanded.insights.total_interactions) },
                    ...(expanded.insights.views !== undefined ? [{ label: 'Views', value: fmt(expanded.insights.views) }] : []),
                    { label: 'Engagement', value: engagementRate(expanded, followers) + '%' },
                  ].map(m => (
                    <div key={m.label} className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-gray-400">{m.label}</p>
                      <p className="font-mono text-sm font-semibold text-gray-900 mt-0.5">{m.value}</p>
                    </div>
                  ))}
                </div>
                <a
                  href={expanded.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center py-2 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                  Open in Instagram
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
