'use client'

/**
 * RatioSelector / StyleSelector - 公共选择器组件
 * 卡片边框风格：选中时蓝色描边 + 淡色背景 + 加粗文字
 *
 * 使用场景：首页、项目故事输入页
 */
import { createPortal } from 'react-dom'
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, type CSSProperties } from 'react'
import { AppIcon } from '@/components/ui/icons'

const TRIGGER_CLASSNAME = 'glass-input-base flex h-10 w-full items-center justify-between gap-2 px-2.5 transition-colors'
const TRIGGER_TEXT_CLASSNAME = 'text-[13px] font-medium text-[var(--glass-text-primary)]'

const VIEWPORT_EDGE_GAP = 8
const DEFAULT_MAX_HEIGHT = 280
const STYLE_RECENT_STORAGE_KEY = 'waoowaoo:recent-art-styles'
const STYLE_RECENT_LIMIT = 6

interface StyleOption {
  value: string
  label: string
  recommended?: boolean
  featured?: boolean
  category?: string
  keywords?: readonly string[]
}

function useFloatingDropdown(isOpen: boolean, minWidth: number, maxHeight = DEFAULT_MAX_HEIGHT) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return

    const rect = triggerRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth
    const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_EDGE_GAP
    const spaceAbove = rect.top - VIEWPORT_EDGE_GAP
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow
    const availableSpace = openUpward ? spaceAbove : spaceBelow
    const width = Math.min(
      Math.max(rect.width, minWidth),
      viewportWidth - VIEWPORT_EDGE_GAP * 2,
    )
    const left = Math.min(
      Math.max(VIEWPORT_EDGE_GAP, rect.left),
      viewportWidth - width - VIEWPORT_EDGE_GAP,
    )

    setPanelStyle({
      position: 'fixed',
      left,
      width,
      maxHeight: Math.max(120, Math.min(maxHeight, availableSpace)),
      ...(openUpward
        ? { bottom: viewportHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    })
  }, [maxHeight, minWidth])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      if (!isOpen) return
      setPanelStyle({})
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  useLayoutEffect(() => {
    if (!isOpen) return

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen, updatePosition])

  return { triggerRef, panelRef, panelStyle }
}

/** 线框比例预览块 */
function RatioShape({ ratio, selected, size = 26 }: { ratio: string; selected: boolean; size?: number }) {
  const [w, h] = ratio.split(':').map(Number)
  const max = Math.max(w, h)
  return (
    <div
      className={`rounded-md border-2 transition-colors ${
        selected ? 'border-[var(--glass-accent-from)]' : 'border-[var(--glass-stroke-strong)]'
      }`}
      style={{
        width: Math.min(size, size * (w / max)),
        height: Math.min(size, size * (h / max)),
      }}
    />
  )
}

export function RatioSelector({
  value,
  onChange,
  options,
  getUsage,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string; recommended?: boolean }[]
  getUsage?: (ratio: string) => string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const { triggerRef, panelRef, panelStyle } = useFloatingDropdown(isOpen, 300)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      if (isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, panelRef, triggerRef])

  const selectedOption = options.find((o) => o.value === value)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`${TRIGGER_CLASSNAME} cursor-pointer`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <RatioShape ratio={value} size={18} selected />
          <span className={`${TRIGGER_TEXT_CLASSNAME} truncate`}>{selectedOption?.label || value}</span>
        </div>
        <AppIcon name="chevronDown" className={`w-4 h-4 text-[var(--glass-text-tertiary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className="glass-surface-modal z-[9999] p-3 overflow-y-auto app-scrollbar"
          style={panelStyle}
        >
          <div className="grid grid-cols-5 gap-2">
            {options.map((option) => {
              const isSelected = value === option.value
              const usageTag = getUsage?.(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-[var(--glass-accent-from)] bg-[var(--glass-accent-from)]/5 shadow-sm'
                      : 'border-[var(--glass-stroke-soft)] hover:border-[var(--glass-stroke-strong)]'
                  }`}
                  title={usageTag || undefined}
                >
                  <RatioShape ratio={option.value} size={28} selected={isSelected} />
                  <span className={`text-xs ${isSelected ? 'font-semibold text-[var(--glass-accent-from)]' : 'text-[var(--glass-text-secondary)]'}`}>
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

export function StyleSelector({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: StyleOption[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('全部')
  const [recentValues, setRecentValues] = useState<string[]>([])
  const { triggerRef, panelRef, panelStyle } = useFloatingDropdown(isOpen, showAll ? 680 : 360, showAll ? 540 : 320)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      if (isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, panelRef, triggerRef])

  useEffect(() => {
    if (!isOpen) {
      setShowAll(false)
      setSearchText('')
      setCategoryFilter('全部')
      return
    }

    try {
      const raw = window.localStorage.getItem(STYLE_RECENT_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const validValues = parsed.filter((item): item is string =>
        typeof item === 'string' && options.some((option) => option.value === item),
      )
      setRecentValues(validValues.slice(0, STYLE_RECENT_LIMIT))
    } catch {
      setRecentValues([])
    }
  }, [isOpen, options])

  const selectedOption = options.find((o) => o.value === value) || options[0]
  const featuredOptions = useMemo(() => {
    const featured = options.filter((option) => option.featured || option.recommended)
    return (featured.length > 0 ? featured : options).slice(0, 12)
  }, [options])
  const categories = useMemo(() => {
    const names = options
      .map((option) => option.category)
      .filter((category): category is string => Boolean(category))
    return ['全部', ...Array.from(new Set(names))]
  }, [options])
  const recentOptions = useMemo(() => {
    return recentValues
      .map((recentValue) => options.find((option) => option.value === recentValue))
      .filter((option): option is StyleOption => Boolean(option))
  }, [options, recentValues])
  const filteredOptions = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    return options.filter((option) => {
      const matchesCategory = categoryFilter === '全部' || option.category === categoryFilter
      if (!matchesCategory) return false
      if (!query) return true

      const haystack = [
        option.label,
        option.value,
        option.category,
        ...(option.keywords ?? []),
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [categoryFilter, options, searchText])
  const groupedOptions = useMemo(() => {
    return filteredOptions.reduce<Record<string, StyleOption[]>>((groups, option) => {
      const category = option.category ?? '其他'
      groups[category] = [...(groups[category] ?? []), option]
      return groups
    }, {})
  }, [filteredOptions])

  const selectOption = (nextValue: string) => {
    onChange(nextValue)
    setIsOpen(false)

    const nextRecentValues = [
      nextValue,
      ...recentValues.filter((recentValue) => recentValue !== nextValue),
    ].slice(0, STYLE_RECENT_LIMIT)
    setRecentValues(nextRecentValues)
    try {
      window.localStorage.setItem(STYLE_RECENT_STORAGE_KEY, JSON.stringify(nextRecentValues))
    } catch {
      // localStorage 不可用时仅跳过最近使用记录。
    }
  }

  const renderStyleButton = (option: StyleOption, compact = false) => {
    const isSelected = value === option.value
    return (
      <button
        key={option.value}
        type="button"
        onClick={() => selectOption(option.value)}
        className={`flex items-center gap-2 rounded-xl border text-left transition-all ${
          compact ? 'px-3 py-2' : 'p-3'
        } ${
          isSelected
            ? 'border-[var(--glass-accent-from)] bg-[var(--glass-accent-from)]/5 shadow-sm'
            : 'border-[var(--glass-stroke-soft)] hover:border-[var(--glass-stroke-strong)] hover:bg-[var(--glass-bg-surface-strong)]'
        }`}
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold ${
          isSelected
            ? 'bg-[var(--glass-accent-from)] text-white'
            : 'bg-[var(--glass-bg-muted)] text-[var(--glass-text-tertiary)]'
        }`}>
          {option.label.slice(0, 1)}
        </span>
        <span className={`min-w-0 truncate text-sm ${
          isSelected ? 'font-semibold text-[var(--glass-accent-from)]' : 'text-[var(--glass-text-secondary)]'
        }`}>
          {option.label}
        </span>
      </button>
    )
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`${TRIGGER_CLASSNAME} cursor-pointer`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <AppIcon name="sparklesAlt" className="h-4 w-4 text-[var(--glass-accent-from)]" />
          <span className={`${TRIGGER_TEXT_CLASSNAME} truncate`}>{selectedOption.label}</span>
        </div>
        <AppIcon name="chevronDown" className={`w-4 h-4 text-[var(--glass-text-tertiary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className={`glass-surface-modal z-[9999] p-3 ${showAll ? 'overflow-y-auto app-scrollbar' : 'overflow-hidden'}`}
          style={panelStyle}
        >
          {showAll ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  className="glass-btn-base h-9 shrink-0 px-3 text-xs"
                >
                  <AppIcon name="chevronLeft" className="h-4 w-4" />
                  热门
                </button>
                <div className="glass-input-base flex h-9 min-w-0 flex-1 items-center gap-2 px-3">
                  <AppIcon name="search" className="h-4 w-4 shrink-0 text-[var(--glass-text-tertiary)]" />
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="搜索风格"
                    className="min-w-0 flex-1 bg-transparent text-sm text-[var(--glass-text-primary)] outline-none placeholder:text-[var(--glass-text-tertiary)]"
                  />
                  {searchText ? (
                    <button
                      type="button"
                      onClick={() => setSearchText('')}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--glass-text-tertiary)] hover:bg-[var(--glass-bg-muted)] hover:text-[var(--glass-text-primary)]"
                      aria-label="清空搜索"
                    >
                      <AppIcon name="close" className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              {recentOptions.length > 0 && !searchText && categoryFilter === '全部' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--glass-text-tertiary)]">
                    <AppIcon name="clock" className="h-3.5 w-3.5" />
                    最近使用
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {recentOptions.map((option) => renderStyleButton(option, true))}
                  </div>
                </div>
              ) : null}

              <div className="flex gap-2 overflow-x-auto pb-1 app-scrollbar">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setCategoryFilter(category)}
                    className={`h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-all ${
                      categoryFilter === category
                        ? 'border-[var(--glass-accent-from)] bg-[var(--glass-accent-from)]/10 text-[var(--glass-accent-from)]'
                        : 'border-[var(--glass-stroke-soft)] text-[var(--glass-text-secondary)] hover:border-[var(--glass-stroke-strong)]'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="pr-1">
                {filteredOptions.length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(groupedOptions).map(([category, categoryOptions]) => (
                      <div key={category} className="space-y-2">
                        {categoryFilter === '全部' ? (
                          <div className="text-xs font-semibold text-[var(--glass-text-tertiary)]">{category}</div>
                        ) : null}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {categoryOptions.map((option) => renderStyleButton(option))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-[var(--glass-stroke-soft)] text-sm text-[var(--glass-text-tertiary)]">
                    没有匹配的风格
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-[var(--glass-text-tertiary)]">热门推荐</div>
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="text-xs font-medium text-[var(--glass-tone-info-fg)] hover:underline"
                >
                  更多风格
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {featuredOptions.map((option) => renderStyleButton(option))}
              </div>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--glass-stroke-strong)] text-sm font-medium text-[var(--glass-text-secondary)] transition-all hover:border-[var(--glass-accent-from)] hover:text-[var(--glass-accent-from)]"
              >
                <AppIcon name="search" className="h-4 w-4" />
                查看全部风格
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}

export function StylePresetSelector({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string; description: string }[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const { triggerRef, panelRef, panelStyle } = useFloatingDropdown(isOpen, 260)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      if (isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, panelRef, triggerRef])

  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`${TRIGGER_CLASSNAME} cursor-pointer`}
        title={selectedOption.label}
      >
        <div className="flex min-w-0 items-center gap-2">
          <AppIcon name="clapperboard" className="h-4 w-4 shrink-0 text-[var(--glass-accent-from)]" />
          <span className={`${TRIGGER_TEXT_CLASSNAME} min-w-0 flex-1 truncate`}>
            {selectedOption.label}
          </span>
        </div>
        <AppIcon name="chevronDown" className={`h-4 w-4 text-[var(--glass-text-tertiary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className="glass-surface-modal z-[9999] p-2.5"
          style={panelStyle}
        >
          <div className="flex flex-col gap-2">
            {options.map((option) => {
              const isSelected = value === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                    isSelected
                      ? 'border-[var(--glass-accent-from)] bg-[var(--glass-accent-from)]/5 shadow-sm'
                      : 'border-[var(--glass-stroke-soft)] hover:border-[var(--glass-stroke-strong)]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`text-sm ${isSelected ? 'font-semibold text-[var(--glass-accent-from)]' : 'font-medium text-[var(--glass-text-primary)]'}`}>
                      {option.label}
                    </div>
                    <div className="text-xs text-[var(--glass-text-tertiary)]">
                      {option.description}
                    </div>
                  </div>
                  {isSelected && (
                    <AppIcon name="check" className="h-4 w-4 shrink-0 text-[var(--glass-accent-from)]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

export function StylePresetBadge({
  label,
  description,
}: {
  label: string
  description: string
}) {
  return (
    <div className="glass-input-base relative flex h-10 w-full items-center gap-2 overflow-hidden px-2.5">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(99,102,241,0.1))',
        }}
      />
      <AppIcon name="clapperboard" className="relative h-4 w-4 shrink-0 text-[var(--glass-accent-from)]" />
      <span className="relative min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--glass-text-primary)]">
        {label}
      </span>
      <span className="relative shrink-0 rounded-full bg-[var(--glass-tone-info-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--glass-tone-info-fg)]">
        {description}
      </span>
    </div>
  )
}
