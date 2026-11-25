import { useNavigate } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { Gavel, Trophy, Sparkles, ArrowLeft, ChevronDown, ChevronUp, IndianRupee, AlertTriangle } from "lucide-react"
import { useAuctionCurrent, usePlayer, useAuctionTargets, usePlayers } from "../lib/queries"
import { auctionApi } from "../lib/api"
import { cn } from "../lib/utils"
import { findMostExpensiveSale } from "../lib/auctionNarrative"
import { useAuctionReveal } from "../hooks/useAuctionReveal"
import TeamPanel from "../components/auction/TeamPanel"
import PoolPanel from "../components/auction/AuctionPoolPanel"
import { useAuctionSocket } from "../hooks/useAuctionSocket"
import { useAuctionTimer } from "../hooks/useAuctionTimer"
import { useBumpOnChange } from "../hooks/useBumpOnChange"
import HeadToHead from "../components/player/HeadToHead"
import SeasonSummary from "../components/player/SeasonSummary"
import { getAvatarById } from "../lib/avatars"
import SmartAnalysis from "../components/auction/SmartAnalysis"
import AuctionIntelPanel from "../components/auction/AuctionIntelPanel"
import { GradeScarcityCounter, BestRemainingAlert } from "../components/auction/AuctionLiveAlerts"
import { useAuthStore } from "../store/authStore"
import { useCachedImage } from "../hooks/useCachedImage"

const CARD_COLORS = { silver: "text-slate-300", gold: "text-gold", purple: "text-purple-300" }

function FormDot({ result }) {
  const styles = {
    W: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    D: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    L: "bg-rose-500/20 text-rose-400 border-rose-500/40",
  }
  return <span className={cn("w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold", styles[result] || styles.D)}>{result}</span>
}



// Shows player avatar + previous team logo in the auction stage center panel
function AuctionPlayerHero({ session, teamLogoById }) {
  const preset      = getAvatarById(session.currentPlayerAvatarId)
  const rawAvatar   = session.currentPlayerAvatarUrl   || preset?.thumb || null
  const avatarSrc   = useCachedImage(rawAvatar)
  const prevLogoSrc = useCachedImage(teamLogoById?.[session.currentPlayerPrevTeamId])

  return (
    <>
      {/* Avatar — centered above player name */}
      {avatarSrc && (
        <div className="flex justify-center mb-3">
          <img
            src={avatarSrc}
            alt={session.currentPlayerName}
            className="w-20 h-20 rounded-2xl object-cover border-2 border-surface-border shadow-lg"
          />
        </div>
      )}
    </>
  )
}

// Previous team logo shown BELOW the card type + grade badges
function PrevTeamLogo({ session, teamLogoById, teamNameById }) {
  const prevLogoSrc = useCachedImage(teamLogoById?.[session.currentPlayerPrevTeamId])
  if (!session.currentPlayerPrevTeamId) return null

  return (
    <div className="flex flex-col items-center gap-1 mt-3 mb-2">
      {prevLogoSrc ? (
        <img
          src={prevLogoSrc}
          alt="Previous team"
          className="w-16 h-16 rounded-full object-cover border-2 border-surface-border shadow-md"
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-pitch-800 border-2 border-surface-border flex items-center justify-center text-sm font-bold text-slate-400">
          {teamNameById?.[session.currentPlayerPrevTeamId]?.slice(0,2).toUpperCase()}
        </div>
      )}
      <p className="text-[10px] text-slate-500 font-medium">Previous team</p>
    </div>
  )
}


// Full auction stage panel with player bg image as hero background
function AuctionStagePanel({ session, teamLogoById, teamNameById, currentPlayer, bidBumping, timerActive, waitingForBid, timeLeft }) {
  const preset    = getAvatarById(session.currentPlayerAvatarId)
  const rawAvatar = session.currentPlayerAvatarUrl   || preset?.thumb || null
  const rawBg     = session.currentPlayerAvatarBgUrl || preset?.bg    || null
  const avatarSrc = useCachedImage(rawAvatar)
  const bgSrc     = useCachedImage(rawBg)

  return (
    <div className={cn("relative rounded-2xl overflow-hidden border border-surface-border text-center", session.currentPlayerId && "auction-stage")}>
      {/* Player bg image as hero background */}
      {bgSrc && (
        <>
          <div className="absolute inset-0 bg-cover bg-center bg-top" style={{ backgroundImage: `url(${bgSrc})` }} />
          <div className="absolute inset-0 bg-pitch-900/75" />
        </>
      )}
      {!bgSrc && <div className="absolute inset-0 bg-gradient-to-br from-pitch-800 to-pitch-900" />}

      <div className="relative z-10 p-8">
        {session.currentPlayerId ? (
          <>
            {avatarSrc && (
              <div className="flex justify-center mb-3">
                <img src={avatarSrc} alt={session.currentPlayerName} className="w-20 h-20 rounded-2xl object-cover border-2 border-surface-border shadow-lg" />
              </div>
            )}
            <h2 className="text-3xl auction-stage-name text-white mb-1">{session.currentPlayerName}</h2>
            {session.currentPlayerAlias && (
              <p className="text-sm text-slate-300 mb-1">"{session.currentPlayerAlias}"</p>
            )}
            {currentPlayer?.imageUrl && (
              <img src={currentPlayer.imageUrl} alt={currentPlayer.name} className="w-20 h-20 rounded-xl object-cover border border-surface-border mb-4 mx-auto" />
            )}
            <div className="max-w-sm mx-auto mb-5">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className={cn("text-xs font-bold uppercase px-2 py-0.5 rounded border", CARD_COLORS[session.currentPlayerCardType])}>
                  {session.currentPlayerCardType} card
                </span>
                {currentPlayer?.grade && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-pitch-800/80 border border-surface-border text-slate-300">
                    Grade {currentPlayer.grade}
                  </span>
                )}
              </div>
              <PrevTeamLogo session={session} teamLogoById={teamLogoById} teamNameById={teamNameById} />
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-pitch-800/60 backdrop-blur-sm border border-surface-border rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">Market value</p>
                  <p className="text-lg font-extrabold font-mono text-accent">₹{currentPlayer?.marketValue ?? session.currentPlayerMarketValue ?? "—"}</p>
                </div>
                <div className="bg-pitch-800/60 backdrop-blur-sm border border-surface-border rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">BDR points</p>
                  <p className="text-lg font-extrabold font-mono text-gold">{(currentPlayer?.bdrPoints ?? session.currentPlayerBdrPoints ?? 0).toLocaleString?.() ?? "—"}</p>
                </div>
              </div>
              {currentPlayer?.form?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-slate-400 uppercase tracking-widest mb-2 font-semibold text-center">Recent form</p>
                  <div className="flex items-center justify-center gap-2">
                    {currentPlayer.form.map((r, i) => <FormDot key={i} result={r} />)}
                  </div>
                </div>
              )}
            </div>
            <p className="text-4xl font-mono font-bold text-gold mb-2">
              <span className={cn("auction-stage-bid", bidBumping && "bump")}>₹{session.currentBid}</span>
            </p>
            <p className="text-sm text-slate-300 mb-2">
              {session.currentBidderTeamName ? (
                <>Highest bid: <span className="text-white font-semibold">{session.currentBidderTeamName}</span></>
              ) : "Waiting for bids…"}
            </p>
            {waitingForBid && (
              <div className="auction-timer" style={{ color: "#94a3b8" }}>Waiting for first bid…</div>
            )}
            {timerActive && (
              <div className={cn("auction-timer", timeLeft <= 5 && "red")}>⏱ {timeLeft}s</div>
            )}
          </>
        ) : (
          <>
            <Sparkles className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Waiting for the next player to go under the hammer…</p>
          </>
        )}
      </div>
    </div>
  )
}


// Mobile-only collapsible teams drawer — replaces both side panels on small screens
function MobileTeamsDrawer({ teams, sales, retentions, budgetPerTeam }) {
  const [open, setOpen] = useState(false)
  const allTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="lg:hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-pitch-800 border border-surface-border text-white font-semibold text-sm"
      >
        <div className="flex items-center gap-2">
          <span>👥</span>
          <span>Teams ({allTeams.length})</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-surface-border bg-pitch-800 divide-y divide-surface-border/50 overflow-hidden">
          {allTeams.map(t => {
            const roster       = sales.filter(s => s.teamId === t.id)
            const teamRetained = retentions.filter(r => r.teamId === t.id)
            const captains     = t.captains || []
            const isLowBudget  = t.budget <= 100
            const total        = budgetPerTeam || t.budget
            const spentPct     = total > 0 ? Math.min(100, Math.round(((total - t.budget) / total) * 100)) : 0
            const hasPlayers   = captains.length > 0 || teamRetained.length > 0 || roster.length > 0

            return (
              <div key={t.id} className={cn("px-4 py-3", isLowBudget && "bg-rose-500/5")}>
                <div className="flex items-center gap-3 mb-2">
                  {t.logoUrl
                    ? <img src={t.logoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-surface-border" />
                    : <div className="w-8 h-8 rounded-full bg-pitch-900 border border-surface-border flex items-center justify-center text-xs text-slate-500 font-bold">{t.name[0]}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{t.name}</p>
                    <p className={cn("text-xs", isLowBudget ? "text-rose-400" : "text-slate-400")}>💰 ₹{t.budget} left</p>
                  </div>
                </div>
                <div className="h-1 bg-pitch-900 rounded-full overflow-hidden mb-2">
                  <div className={cn("h-full rounded-full transition-all", spentPct > 80 ? "bg-rose-500" : "bg-amber-400")} style={{ width: `${spentPct}%` }} />
                </div>
                {hasPlayers && (
                  <div className="flex flex-wrap gap-1.5">
                    {captains.map(c => (
                      <span key={c.id} className="text-[10px] px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-gold font-semibold">
                        👑 {c.name}
                      </span>
                    ))}
                    {teamRetained.map(r => (
                      <span key={r.playerId} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 font-semibold">
                        {r.playerName} <span className="opacity-60">RET</span>
                      </span>
                    ))}
                    {roster.map(s => (
                      <span key={s.playerId} className="text-[10px] px-2 py-0.5 rounded-full bg-pitch-900 border border-surface-border text-slate-300">
                        {s.playerName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Team-owner bid panel ────────────────────────────────────────────────────
// Visible only when a player is currently live. Lets the team owner type an
// amount and submit it to POST /api/auction/team-bid.
//
// 409 flow: the server returns { currentBid } when the amount is stale. We
// surface a confirmation dialog — "Someone just bid ₹X. Still want ₹Y?" —
// so the owner can consciously confirm or cancel rather than getting silently
// rejected.
function BidPanel({ session, myTeam }) {
  const [amount, setAmount]           = useState("")
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [success, setSuccess]         = useState(false)
  // outbidDialog: { staleAmount, currentBid } or null
  const [outbidDialog, setOutbidDialog] = useState(null)
  const inputRef = useRef(null)

  const minBid   = (session.currentBid ?? 0) + 1
  const budget   = myTeam?.budget ?? 0
  const hasPlayer = !!session.currentPlayerId
  const isMyTeamLeading = session.currentBidderTeamId === myTeam?.id

  // Clear success flash after 2 s
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(false), 2000)
    return () => clearTimeout(t)
  }, [success])

  // Reset amount field when player changes
  const prevPlayerRef = useRef(session.currentPlayerId)
  useEffect(() => {
    if (session.currentPlayerId !== prevPlayerRef.current) {
      prevPlayerRef.current = session.currentPlayerId
      setAmount("")
      setError(null)
      setSuccess(false)
      setOutbidDialog(null)
    }
  }, [session.currentPlayerId])

  async function submitBid(bidAmount) {
    const parsed = parseInt(bidAmount, 10)
    if (!parsed || parsed < minBid) {
      setError(`Bid must be at least ₹${minBid}`)
      return
    }
    if (parsed > budget) {
      setError(`You only have ₹${budget} left in your budget`)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await auctionApi.teamBid(session.id, parsed)
      setAmount("")
      setSuccess(true)
      inputRef.current?.focus()
    } catch (err) {
      if (err.response?.status === 409) {
        // Stale bid — someone else already bid higher
        setOutbidDialog({ staleAmount: parsed, currentBid: err.response.data.currentBid })
      } else {
        setError(err.response?.data?.error ?? "Failed to place bid. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    submitBid(amount)
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") submitBid(amount)
  }

  if (!hasPlayer) return null

  return (
    <>
      {/* Outbid confirmation dialog */}
      {outbidDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-pitch-800 border border-surface-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-semibold text-sm">Someone just bid ₹{outbidDialog.currentBid}</p>
                <p className="text-slate-400 text-sm mt-1">
                  Your bid of ₹{outbidDialog.staleAmount} is no longer valid.
                  Do you still want to bid ₹{outbidDialog.staleAmount}?
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setOutbidDialog(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-surface-border text-slate-300 text-sm font-medium hover:bg-pitch-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const amt = outbidDialog.staleAmount
                  setOutbidDialog(null)
                  submitBid(amt)
                }}
                className="flex-1 px-4 py-2 rounded-xl bg-accent text-white text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Yes, bid ₹{outbidDialog.staleAmount}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bid panel */}
      <div className={cn(
        "rounded-2xl border p-5 space-y-4 transition-colors",
        isMyTeamLeading
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-surface-border bg-pitch-800/60"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-accent" />
            <span className="text-sm font-bold text-white">Place Your Bid</span>
          </div>
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full border",
            isMyTeamLeading
              ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
              : "text-slate-400 border-surface-border bg-pitch-900"
          )}>
            {isMyTeamLeading ? "🏆 You're leading" : `Budget: ₹${budget}`}
          </span>
        </div>

        {isMyTeamLeading && (
          <p className="text-xs text-slate-400">
            Your team holds the top bid. You can still raise it if needed.
            Budget remaining: <span className="text-white font-semibold">₹{budget}</span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">₹</span>
            <input
              ref={inputRef}
              type="number"
              min={minBid}
              max={budget}
              step={1}
              value={amount}
              onChange={e => { setAmount(e.target.value); setError(null) }}
              onKeyDown={handleKeyDown}
              placeholder={`Min ₹${minBid}`}
              disabled={loading}
              className={cn(
                "w-full pl-7 pr-3 py-2.5 rounded-xl border bg-pitch-900 text-white font-mono text-sm",
                "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent",
                "placeholder:text-slate-600 disabled:opacity-50 transition-colors",
                error ? "border-rose-500/60" : "border-surface-border"
              )}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !amount}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold text-sm transition-all",
              success
                ? "bg-emerald-500 text-white"
                : "bg-accent text-white hover:opacity-90",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {loading ? "…" : success ? "✓ Bid placed!" : "Bid"}
          </button>
        </form>

        {/* Quick-pick buttons */}
        <div className="flex flex-wrap gap-2">
          {[minBid, minBid + 5, minBid + 10, minBid + 25].filter(v => v <= budget).map(v => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className="text-xs px-3 py-1 rounded-lg bg-pitch-900 border border-surface-border text-slate-300 hover:border-accent/50 hover:text-white transition-colors font-mono"
            >
              ₹{v}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-xs text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </p>
        )}
      </div>
    </>
  )
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024)
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener("resize", fn)
    return () => window.removeEventListener("resize", fn)
  }, [])
  return isDesktop
}

// Dedicated live-auction view for team captains — same live data as the
// public /auction/live page, but deliberately WITHOUT the narrative/war/
// collector/MVP/milestone flair (same call as the admin screen: keep it
// focused, not distracting), and WITH each player's real stats shown
// right on the card, since captains actually need that to decide whether
// to bid, not just names and animations.
export default function TeamAuctionLive() {
  const navigate   = useNavigate()
  const isDesktop             = useIsDesktop()
  const myTeamId              = useAuthStore(s => s.user?.teamId)
  const { data: targets = [] }  = useAuctionTargets(myTeamId)
  const { data: allPlayers = [] } = usePlayers()
  const { data } = useAuctionCurrent()
  const { data: currentPlayer } = usePlayer(data?.session?.currentPlayerId)
  const { timeLeft, timerActive, waitingForBid } = useAuctionTimer(data?.session)
  const bidBumping = useBumpOnChange(data?.session?.currentBid)
  useAuctionReveal(data, { showMilestoneBanners: false })
  useAuctionSocket()
  const userRole = useAuthStore(s => s.user?.role)

  if (!data?.session) {
    return (
      <div className="auction-page min-h-screen bg-pitch-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Gavel className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">No auction is currently running</p>
          <button onClick={() => navigate("/team")} className="mt-4 text-sm text-accent hover:underline">← Back to my team</button>
        </div>
      </div>
    )
  }

  const { session, pool = [], sales = [], teams = [], retentions = [] } = data
  const teamNameById = Object.fromEntries(teams.map(t => [t.id, t.name]))
  const teamLogoById  = Object.fromEntries(teams.map(t => [t.id, t.logoUrl]))
  const myTeam        = teams.find(t => t.id === myTeamId) ?? null
  // Players already on my team (bought or retained) — for squad fit calculation
  const myPlayerIds   = [
    ...sales.filter(s => s.teamId === myTeamId).map(s => s.playerId),
    ...retentions.filter(r => r.teamId === myTeamId).map(r => r.playerId),
  ]
  const myPlayers     = allPlayers.filter(p => myPlayerIds.includes(p.id))

  if (session.status === "retention") {
    return (
      <div className="auction-page min-h-screen bg-pitch-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Retention in progress</p>
          <p className="text-sm text-slate-600 mt-1">The auction will begin shortly</p>
        </div>
      </div>
    )
  }

  if (session.status === "completed") {
    const biggest = findMostExpensiveSale(sales)
    return (
      <div className="auction-page min-h-screen bg-pitch-900 flex items-center justify-center p-4">
        <div className="card p-8 text-center max-w-sm">
          <Trophy className="w-8 h-8 text-gold mx-auto mb-3" />
          <h1 className="text-lg font-bold text-white mb-2">Auction Complete</h1>
          <p className="text-sm text-slate-400">{sales.length} players sold</p>
          {biggest && <p className="text-sm text-gold mt-2">Biggest sale: {biggest.playerName} → {biggest.teamName} for ₹{biggest.price}</p>}
          <button onClick={() => navigate("/team")} className="mt-4 text-sm text-accent hover:underline">← Back to my team</button>
        </div>
      </div>
    )
  }

  const leftTeams = teams.slice(0, Math.ceil(teams.length / 2))
  const rightTeams = teams.slice(Math.ceil(teams.length / 2))

  return (
    <div className="auction-page min-h-screen bg-pitch-900 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-6">
        <button onClick={() => navigate("/team")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm w-fit">
          <ArrowLeft className="w-4 h-4" /> My Team
        </button>
        <div className="flex items-center gap-2 sm:mx-auto">
          <Gavel className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-extrabold text-white">Live Player Auction</h1>
          <span className="text-xs text-slate-500">Round {session.round}</span>
        </div>
      </div>

      {/* Mobile: collapsible teams drawer */}
      <MobileTeamsDrawer teams={teams} sales={sales} retentions={retentions} budgetPerTeam={session.budgetPerTeam} />

      <div className="auction-layout max-w-[100rem] mx-auto">
        {isDesktop && <TeamPanel title="👤 Teams" teamList={leftTeams} sales={sales} retentions={retentions} budgetPerTeam={session.budgetPerTeam} />}

        <div className="space-y-4">
          {/* Current player */}
          {/* Resolve player bg for the hero panel */}
          {session && <AuctionStagePanel session={session} teamLogoById={teamLogoById} teamNameById={teamNameById} currentPlayer={currentPlayer} bidBumping={bidBumping} timerActive={timerActive} waitingForBid={waitingForBid} timeLeft={timeLeft} />}

          {/* Overall career record — total wins/draws/losses, games
              played, goals, filterable by match type. Distinct from the
              head-to-head breakdown below, which is per-opponent. */}
          {currentPlayer && <SeasonSummary player={currentPlayer} />}

          {/* Full match history — exact same component the player
              profile page uses, complete opponent-by-opponent record,
              not just a trimmed recent-matches list. */}
          {currentPlayer?.matchHistory?.length > 0 && (
            <HeadToHead matchHistory={currentPlayer.matchHistory} />
          )}

          {/* Grade Scarcity Counter — live count per grade, warns when running low */}
          <GradeScarcityCounter pool={pool} />

          {/* Best Remaining Alert — flashes when top-MV player in pool changes */}
          <BestRemainingAlert pool={pool} />

          {/* Team-owner bid panel — only shown to team_owner role */}
          {userRole === "team_owner" && myTeam && (
            <BidPanel session={session} myTeam={myTeam} />
          )}

          <SmartAnalysis
            session={session}
            pool={pool}
            sales={sales}
            teams={teams}
            retentions={retentions}
            recentBids={data?.recentBids ?? []}
            currentPlayer={currentPlayer}
            myTeamId={myTeamId}
            targets={targets}
            myPlayers={myPlayers}
            isAdmin={false}
          />
          <AuctionIntelPanel
            pool={pool}
            myPlayers={myPlayers}
            sales={sales}
            retentions={retentions}
            myTeamId={myTeamId}
          />
          <PoolPanel pool={pool} clickable />
        </div>

        {isDesktop && <TeamPanel title="👤 Teams" teamList={rightTeams} sales={sales} retentions={retentions} budgetPerTeam={session.budgetPerTeam} />}
      </div>
    </div>
  )
}