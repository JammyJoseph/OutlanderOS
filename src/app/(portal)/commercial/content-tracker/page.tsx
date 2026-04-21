'use client'

import { useState } from 'react'
import { Heart, MessageCircle, Bookmark, Share2, Eye, TrendingUp, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type PostType = 'Post' | 'Reel' | 'Carousel' | 'Story'
type FilterRange = 'this_month' | 'last_month' | 'last_3_months' | 'custom'
type FilterType = 'All' | 'Posts' | 'Reels' | 'Carousels'
type FilterPerf = 'All' | 'Above Average' | 'Below Average'

interface Post {
  id: string
  type: PostType
  date: string
  thumbnail: string
  caption: string
  likes: number
  comments: number
  saves: number
  shares: number
  reach: number
  impressions: number
  engagementRate: number
  campaignId: string | null
}

interface Campaign {
  id: string
  name: string
}

const CAMPAIGNS: Campaign[] = [
  { id: 'c1', name: 'Spring/Summer 2026 Issue' },
  { id: 'c2', name: 'Dior Partnership' },
  { id: 'c3', name: 'Fashion Week Coverage' },
  { id: 'c4', name: 'Emerging Designers Series' },
]

const DEMO_POSTS: Post[] = [
  { id: 'p1', type: 'Reel', date: '2026-04-18', thumbnail: '', caption: 'Behind the scenes at our SS26 cover shoot', likes: 7842, comments: 187, saves: 412, shares: 203, reach: 142000, impressions: 198000, engagementRate: 5.9, campaignId: 'c1' },
  { id: 'p2', type: 'Post', date: '2026-04-15', thumbnail: '', caption: 'Dior SS26 — a study in restraint', likes: 5231, comments: 94, saves: 287, shares: 89, reach: 98000, impressions: 134000, engagementRate: 4.1, campaignId: 'c2' },
  { id: 'p3', type: 'Carousel', date: '2026-04-12', thumbnail: '', caption: '10 looks that defined Fashion Week', likes: 6104, comments: 143, saves: 489, shares: 156, reach: 118000, impressions: 167000, engagementRate: 5.2, campaignId: 'c3' },
  { id: 'p4', type: 'Reel', date: '2026-04-10', thumbnail: '', caption: 'The new wave of Australian designers', likes: 4320, comments: 67, saves: 198, shares: 74, reach: 87000, impressions: 112000, engagementRate: 3.4, campaignId: 'c4' },
  { id: 'p5', type: 'Post', date: '2026-04-08', thumbnail: '', caption: 'Editorial: Midnight in the Garden', likes: 8103, comments: 212, saves: 534, shares: 241, reach: 156000, impressions: 210000, engagementRate: 6.1, campaignId: 'c1' },
  { id: 'p6', type: 'Story', date: '2026-04-06', thumbnail: '', caption: 'Exclusive: First look at Zimmermann AW26', likes: 3241, comments: 41, saves: 112, shares: 38, reach: 67000, impressions: 89000, engagementRate: 2.5, campaignId: null },
  { id: 'p7', type: 'Carousel', date: '2026-04-04', thumbnail: '', caption: 'The art of the accessory', likes: 4897, comments: 88, saves: 321, shares: 102, reach: 94000, impressions: 128000, engagementRate: 3.9, campaignId: 'c3' },
  { id: 'p8', type: 'Reel', date: '2026-04-02', thumbnail: '', caption: 'Sunrise session with Prada', likes: 9241, comments: 234, saves: 612, shares: 287, reach: 178000, impressions: 245000, engagementRate: 6.8, campaignId: 'c2' },
  { id: 'p9', type: 'Post', date: '2026-03-30', thumbnail: '', caption: 'Profile: The woman redefining Australian fashion', likes: 5634, comments: 121, saves: 387, shares: 134, reach: 108000, impressions: 148000, engagementRate: 4.6, campaignId: 'c4' },
  { id: 'p10', type: 'Carousel', date: '2026-03-27', thumbnail: '', caption: 'SS26 trend report: what to wear now', likes: 6782, comments: 165, saves: 523, shares: 178, reach: 131000, impressions: 182000, engagementRate: 5.4, campaignId: 'c1' },
  { id: 'p11', type: 'Reel', date: '2026-03-24', thumbnail: '', caption: 'From sketch to runway', likes: 3102, comments: 48, saves: 143, shares: 52, reach: 61000, impressions: 84000, engagementRate: 2.4, campaignId: null },
  { id: 'p12', type: 'Post', date: '2026-03-20', thumbnail: '', caption: 'Issue 47 — on stands now', likes: 4521, comments: 76, saves: 234, shares: 98, reach: 89000, impressions: 121000, engagementRate: 3.6, campaignId: null },
]

const AVG_LIKES = Math.round(DEMO_POSTS.reduce((s, p) => s + p.likes, 0) / DEMO_POSTS.length)
const AVG_COMMENTS = Math.round(DEMO_POSTS.reduce((s, p) => s + p.comments, 0) / DEMO_POSTS.length)
const AVG_SAVES = Math.round(DEMO_POSTS.reduce((s, p) => s + p.saves, 0) / DEMO_POSTS.length)
const AVG_REACH = Math.round(DEMO_POSTS.reduce((s, p) => s + p.reach, 0) / DEMO_POSTS.length)
const AVG_ENGAGEMENT = parseFloat((DEMO_POSTS.reduce((s, p) => s + p.engagementRate, 0) / DEMO_POSTS.length).toFixed(2))

function fmt(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

const TYPE_COLORS: Record<PostType, string> = {
  Post: 'bg-blue-50 text-blue-700',
  Reel: 'bg-purple-50 text-purple-700',
  Carousel: 'bg-indigo-50 text-indigo-700',
  Story: 'bg-pink-50 text-pink-700',
}

export default function ContentTrackerPage() {
  const [posts, setPosts] = useState<Post[]>(DEMO_POSTS)
  const [filterRange, setFilterRange] = useState<FilterRange>('this_month')
  const [filterType, setFilterType] = useState<FilterType>('All')
  const [filterPerf, setFilterPerf] = useState<FilterPerf>('All')
  const [filterCampaign, setFilterCampaign] = useState<string>('All')
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  function assignCampaign(postId: string, campaignId: string | null) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, campaignId } : p))
    setOpenDropdown(null)
  }

  const filtered = posts.filter(p => {
    if (filterType !== 'All') {
      const map: Record<FilterType, PostType | null> = { All: null, Posts: 'Post', Reels: 'Reel', Carousels: 'Carousel' }
      if (map[filterType] && p.type !== map[filterType]) return false
    }
    if (filterPerf === 'Above Average' && p.engagementRate < AVG_ENGAGEMENT) return false
    if (filterPerf === 'Below Average' && p.engagementRate >= AVG_ENGAGEMENT) return false
    if (filterCampaign === 'Unassigned' && p.campaignId !== null) return false
    if (filterCampaign !== 'All' && filterCampaign !== 'Unassigned' && p.campaignId !== filterCampaign) return false
    return true
  })

  const campaignPosts = selectedCampaign ? posts.filter(p => p.campaignId === selectedCampaign) : []
  const campaignData = selectedCampaign ? CAMPAIGNS.find(c => c.id === selectedCampaign) : null
  const campaignTotalReach = campaignPosts.reduce((s, p) => s + p.reach, 0)
  const campaignTotalImpressions = campaignPosts.reduce((s, p) => s + p.impressions, 0)
  const campaignAvgEngagement = campaignPosts.length
    ? parseFloat((campaignPosts.reduce((s, p) => s + p.engagementRate, 0) / campaignPosts.length).toFixed(2))
    : 0

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Demo banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2">
        <span className="text-xs text-amber-800 font-medium">Demo data</span>
        <span className="text-xs text-amber-700">— Connect Instagram Graph API for live data</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Account overview */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm">O</div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">@outlandermagazine</p>
                <p className="text-xs text-gray-500">153.4K followers · 847 posts</p>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Avg Likes', value: fmt(AVG_LIKES), icon: Heart },
                { label: 'Avg Comments', value: fmt(AVG_COMMENTS), icon: MessageCircle },
                { label: 'Avg Saves', value: fmt(AVG_SAVES), icon: Bookmark },
                { label: 'Avg Reach', value: fmt(AVG_REACH), icon: Eye },
                { label: 'Avg Engagement', value: AVG_ENGAGEMENT + '%', icon: TrendingUp },
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
              <option value="custom">Custom range</option>
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
              {CAMPAIGNS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="ml-auto text-xs text-gray-400">{filtered.length} posts</span>
          </div>

          {/* Post grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-4 gap-4">
              {filtered.map(post => {
                const aboveAvg = post.engagementRate >= AVG_ENGAGEMENT
                const assignedCampaign = CAMPAIGNS.find(c => c.id === post.campaignId)
                return (
                  <div key={post.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Thumbnail */}
                    <div className="aspect-square bg-gray-100 relative flex items-center justify-center">
                      <span className="text-gray-300 text-xs">{post.type}</span>
                      <span className={cn('absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full', TYPE_COLORS[post.type])}>
                        {post.type}
                      </span>
                    </div>

                    <div className="p-3 space-y-2">
                      {/* Date + caption */}
                      <div>
                        <p className="text-[10px] text-gray-400">{new Date(post.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <p className="text-xs text-gray-700 line-clamp-2 mt-0.5 leading-snug">{post.caption}</p>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                        <div className="flex items-center gap-1 text-gray-600"><Heart className="w-3 h-3 text-rose-400" />{fmt(post.likes)}</div>
                        <div className="flex items-center gap-1 text-gray-600"><MessageCircle className="w-3 h-3 text-blue-400" />{fmt(post.comments)}</div>
                        <div className="flex items-center gap-1 text-gray-600"><Bookmark className="w-3 h-3 text-amber-400" />{fmt(post.saves)}</div>
                        <div className="flex items-center gap-1 text-gray-600"><Share2 className="w-3 h-3 text-green-400" />{fmt(post.shares)}</div>
                        <div className="flex items-center gap-1 text-gray-600 col-span-2"><Eye className="w-3 h-3 text-purple-400" />{fmt(post.reach)} reach</div>
                      </div>

                      {/* Engagement rate badge */}
                      <div className="flex items-center justify-between">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', aboveAvg ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
                          {post.engagementRate}% eng.
                        </span>
                      </div>

                      {/* Campaign assignment */}
                      {assignedCampaign ? (
                        <div className="flex items-center gap-1">
                          <span className="flex-1 text-[10px] bg-amber-50 text-amber-700 rounded-full px-2 py-0.5 truncate">{assignedCampaign.name}</span>
                          <button onClick={() => assignCampaign(post.id, null)} className="text-gray-300 hover:text-gray-500 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === post.id ? null : post.id)}
                            className="w-full flex items-center justify-between text-[10px] border border-gray-200 rounded-lg px-2 py-1 text-gray-500 hover:border-amber-300 hover:text-gray-700 transition-colors">
                            Add to campaign <ChevronDown className="w-3 h-3" />
                          </button>
                          {openDropdown === post.id && (
                            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
                              {CAMPAIGNS.map(c => (
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
                )
              })}
            </div>
          </div>
        </div>

        {/* Campaign sidebar */}
        <div className="w-72 border-l border-gray-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Campaign Performance</p>
            <select value={selectedCampaign ?? ''} onChange={e => setSelectedCampaign(e.target.value || null)}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D4A853]">
              <option value="">Select a campaign...</option>
              {CAMPAIGNS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {selectedCampaign && campaignData ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-gray-900">{campaignData.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{campaignPosts.length} posts assigned</p>
              </div>

              {/* Aggregated metrics */}
              <div className="space-y-2">
                {[
                  { label: 'Total Reach', value: fmt(campaignTotalReach) },
                  { label: 'Total Impressions', value: fmt(campaignTotalImpressions) },
                  { label: 'Avg Engagement', value: campaignAvgEngagement + '%' },
                ].map(m => (
                  <div key={m.label} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-xs text-gray-500">{m.label}</span>
                    <span className="text-sm font-semibold font-mono text-gray-900">{m.value}</span>
                  </div>
                ))}
              </div>

              {/* vs benchmark */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">vs Account Average</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Engagement rate</span>
                  <span className={cn('text-xs font-semibold', campaignAvgEngagement >= AVG_ENGAGEMENT ? 'text-green-600' : 'text-red-500')}>
                    {campaignAvgEngagement >= AVG_ENGAGEMENT ? '+' : ''}{(campaignAvgEngagement - AVG_ENGAGEMENT).toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Assigned posts list */}
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Posts</p>
                <div className="space-y-2">
                  {campaignPosts.map(p => (
                    <div key={p.id} className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-md bg-gray-100 shrink-0 flex items-center justify-center">
                        <span className="text-[8px] text-gray-400">{p.type[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-700 truncate">{p.caption}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{p.engagementRate}% · {fmt(p.reach)} reach</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button className="w-full py-2 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                  Export Report
                </button>
                <button className="w-full py-2 rounded-lg bg-[#D4A853] text-white text-xs font-semibold hover:bg-[#C49843] transition-colors">
                  Share with Client
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-xs text-gray-400 text-center">Select a campaign to view aggregated performance</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
