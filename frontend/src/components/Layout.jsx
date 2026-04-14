import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useUser, useClerk, useAuth } from '@clerk/clerk-react'
import { api } from '../lib/api'
import {
  LayoutDashboard, Brain, History, Upload,
  GraduationCap, FlaskConical, BarChart2, Sliders, Target,
  Search, Shield, Dna, GitBranch, ChevronDown,
  User, LogOut, Zap, X, Menu, PanelLeftClose, PanelLeftOpen
} from 'lucide-react'
import clsx from 'clsx'

const NAV_SECTIONS = [
  {
    label: 'Main Menu',
    items: [
      { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/predict',     icon: Brain,            label: 'Predict Student' },
      { to: '/batch',       icon: Upload,           label: 'Batch Upload' },
      { to: '/history',     icon: History,          label: 'History' },
      { to: '/analytics',   icon: BarChart2,        label: 'Analytics' },
    ]
  },
  {
    label: 'Advanced Tools',
    items: [
      { to: '/insights',    icon: FlaskConical,     label: 'Model Insights' },
      { to: '/whatif',      icon: Sliders,          label: 'What-If Simulator' },
      { to: '/threshold',   icon: Target,           label: 'Threshold Optimizer' },
    ]
  },
  {
    label: 'AI Research',
    items: [
      { to: '/fairness',    icon: Shield,           label: 'Fairness Audit' },
      { to: '/counterfactuals', icon: GitBranch,    label: 'Counterfactuals' },
      { to: '/survival',    icon: Dna,              label: 'Survival Analysis' },
      { to: '/active-learning', icon: Zap,          label: 'Active Learning' },
    ]
  }
]

function StudentSearchBar({ isCollapsed, onExpand }) {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!q.trim() || q.length < 2) { setResults([]); setOpen(false); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const token = await getToken()
        const data = await api.searchStudents(token, q, 8)
        setResults(data.results || [])
        setOpen(true)
      } catch { setResults([]) } finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [q, getToken])

  const handleSelect = (student) => {
    const id = student.student_id || student.student_name
    navigate(`/students/${encodeURIComponent(id)}`)
    setQ(''); setOpen(false); setResults([])
  }

  if (isCollapsed) {
    return (
      <div className="flex justify-center py-1 mb-2">
        <button onClick={onExpand} className="p-2.5 mx-1 rounded-lg hover:bg-white/10 text-ghost hover:text-cream transition-colors" title="Search Students">
          <Search size={18} />
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative px-3 mb-2">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search student..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-white/5 border border-white/10
                     text-xs text-cream placeholder-muted/60 focus:outline-none
                     focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all"
        />
        {q && (
          <button onClick={() => { setQ(''); setOpen(false) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-cream">
            <X size={12} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute top-full left-3 right-3 mt-1 rounded-lg bg-slate/95
                        backdrop-blur-xl border border-white/10 shadow-2xl z-50 overflow-hidden">
          {loading && (
            <div className="px-3 py-2 text-xs text-muted text-center">Searching...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted text-center">No students found</div>
          )}
          {results.map((s, i) => (
            <button key={i} onClick={() => handleSelect(s)}
                    className="w-full px-3 py-2 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
              <div className="text-xs text-cream font-medium">{s.student_name || 'Unknown'}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted font-mono">{s.student_id || '—'}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                  ${s.risk_level === 'Critical' ? 'bg-danger/20 text-danger' :
                    s.risk_level === 'High' ? 'bg-warn/20 text-warn' :
                    s.risk_level === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-safe/20 text-safe'
                  }`}>{s.risk_level}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UserProfilePanel({ isCollapsed }) {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState('advisor')
  const { getToken } = useAuth()
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    getToken().then(token => {
      if (token) api.getMyRole(token).then(r => setRole(r.role)).catch(() => {})
    })
  }, [getToken])

  if (!user) return null

  const name = user.fullName || user.firstName || user.username || 'User'
  const email = user.primaryEmailAddress?.emailAddress || ''
  const avatar = user.imageUrl

  return (
    <div ref={ref} className={clsx("relative", isCollapsed && "px-1")}>
      <button
        onClick={() => setOpen(v => !v)}
        className={clsx(
          "w-full flex items-center gap-3 py-2.5 rounded-xl hover:bg-white/10 transition-all duration-150 group",
          isCollapsed ? "justify-center px-0" : "px-3"
        )}
      >
        <div className="relative shrink-0">
          {avatar ? (
            <img src={avatar} alt={name}
                 className={clsx("rounded-full object-cover border border-white/20 transition-all", isCollapsed ? "w-9 h-9" : "w-8 h-8")} />
          ) : (
            <div className={clsx("rounded-full bg-accent/30 flex items-center justify-center border border-white/20 transition-all", isCollapsed ? "w-9 h-9" : "w-8 h-8")}>
              <User size={14} className="text-accent" />
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full
                          bg-safe border-2 border-[#1a1d26] shadow-[0_0_6px_rgba(61,190,122,0.8)]" />
        </div>
        {!isCollapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-xs font-semibold text-cream truncate">{name}</div>
              <div className="text-[10px] text-muted truncate">{email}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase
                ${role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-white/10 text-muted'}`}>
                {role}
              </span>
              <ChevronDown size={11} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          </>
        )}
      </button>

      {open && (
        <div className={clsx(
          "absolute bottom-full mb-2 rounded-xl bg-[#1a1d26]/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden z-50",
          isCollapsed ? "left-12 w-64" : "left-0 right-0"
        )}>
          {/* Profile header */}
          <div className="px-4 py-3 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              {avatar ? (
                <img src={avatar} alt={name}
                     className="w-10 h-10 rounded-full border border-white/20" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center">
                  <User size={16} className="text-accent" />
                </div>
              )}
              <div>
                <div className="text-sm font-semibold text-cream">{name}</div>
                <div className="text-xs text-muted">{email}</div>
                <div className={`text-[9px] mt-0.5 px-1.5 py-0.5 rounded-full font-mono uppercase inline-block
                  ${role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-white/10 text-muted'}`}>
                  {role}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-1.5">
            <button
              onClick={() => signOut()}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg
                         text-sm text-danger hover:bg-danger/10 transition-all"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Layout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Prevent scrolling when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => { document.body.style.overflow = 'auto' }
  }, [isMobileOpen])

  return (
    <div className="flex min-h-screen bg-[#1a1d26]">
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={clsx(
          "bg-slate/40 backdrop-blur-2xl border-r border-white/10 flex flex-col fixed h-full z-50 shadow-[4px_0_24px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out",
          isCollapsed ? "w-[80px]" : "w-[250px]",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo and Toggle */}
        <div className={clsx("px-4 py-4 border-b border-white/10 flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 bg-accent/80 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-[0_4px_12px_rgba(91,138,240,0.4)] shrink-0">
              <GraduationCap size={18} className="text-white drop-shadow" />
            </div>
            {!isCollapsed && (
              <div className="whitespace-nowrap transition-opacity duration-300">
                <span className="font-display font-bold text-cream text-base leading-none tracking-wide">DropoutIQ</span>
                <p className="text-accent text-[10px] uppercase tracking-widest mt-0.5 font-medium font-mono">v4 · Risk Intelligence</p>
              </div>
            )}
          </div>
          
          {/* Desktop Toggle Button - Show only when expanded */}
          {!isCollapsed && (
            <button 
              onClick={() => setIsCollapsed(true)}
              className="hidden lg:flex p-1.5 rounded-lg text-muted hover:text-cream hover:bg-white/10 transition-colors"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        {/* Desktop Toggle Button - Show only when collapsed */}
        {isCollapsed && (
          <div className="hidden lg:flex justify-center pb-2 pt-4">
            <button 
              onClick={() => setIsCollapsed(false)}
              className="p-1.5 rounded-lg text-muted hover:text-cream hover:bg-white/10 transition-colors"
            >
               <PanelLeftOpen size={16} />
            </button>
          </div>
        )}

        {/* Search */}
        <div className={clsx("pb-1", isCollapsed ? "pt-2" : "pt-3")}>
          <StudentSearchBar isCollapsed={isCollapsed} onExpand={() => setIsCollapsed(false)} />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto no-scrollbar scroll-smooth">
          {NAV_SECTIONS.map((section, idx) => (
            <div key={idx}>
              {!isCollapsed && (
                <div className="px-3 pt-1 pb-2">
                  <div className="text-[10px] text-muted/70 uppercase tracking-widest font-mono font-medium">{section.label}</div>
                </div>
              )}
              {isCollapsed && idx !== 0 && <div className="h-px bg-white/5 my-3 mx-2" />}
              <div className="space-y-1">
                {section.items.map(({ to, icon: Icon, label }) => (
                  <NavLink 
                    key={to}
                    to={to}
                    onClick={() => setIsMobileOpen(false)}
                    title={isCollapsed ? label : undefined}
                    className={({ isActive }) => clsx(
                      'group flex items-center gap-3 rounded-lg font-display transition-all duration-200 relative overflow-hidden',
                      isCollapsed ? 'justify-center p-2.5 mx-1' : 'px-3 py-2.5',
                      isActive
                        ? 'bg-accent/15 text-accent border border-accent/20 shadow-[inset_0_0_12px_rgba(91,138,240,0.1)]'
                        : 'text-ghost hover:text-cream hover:bg-white/5 border border-transparent'
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active Indicator Line */}
                        {isActive && (
                          <div className={clsx(
                            "absolute left-0 top-1/2 -translate-y-1/2 bg-accent rounded-r-md shadow-[0_0_8px_rgba(91,138,240,0.6)]",
                            isCollapsed ? "w-1 h-3/5" : "w-1.5 h-2/3"
                          )} />
                        )}
                        <Icon size={isCollapsed ? 18 : 16} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
                        {!isCollapsed && (
                          <span className="text-xs font-medium whitespace-nowrap tracking-wide">{label}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile */}
        <div className="px-3 py-3 border-t border-white/10 shrink-0">
          {!isCollapsed && (
            <div className="flex items-center gap-2 text-xs text-cream mb-2 px-1">
              <div className="w-2 h-2 rounded-full bg-safe shadow-[0_0_8px_rgba(61,190,122,0.8)] animate-pulse" />
              <span className="text-muted text-[10px]">API Connected</span>
            </div>
          )}
          <UserProfilePanel isCollapsed={isCollapsed} />
        </div>
      </aside>

      {/* Main Content Area */}
      <main 
        className={clsx(
          "flex-1 min-h-screen relative z-0 flex flex-col transition-all duration-300 ease-in-out",
          isCollapsed ? "lg:ml-[80px]" : "lg:ml-[250px]"
        )}
      >
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-white/10 bg-[#1a1d26]/80 backdrop-blur-md sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent/80 rounded-lg flex items-center justify-center">
              <GraduationCap size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-cream text-base">DropoutIQ</span>
          </div>
          <button 
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 rounded-lg text-cream hover:bg-white/10 transition-colors"
          >
            <Menu size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}
