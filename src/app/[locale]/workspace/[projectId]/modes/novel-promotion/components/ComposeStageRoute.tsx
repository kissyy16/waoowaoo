'use client'

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import TaskStatusInline from '@/components/task/TaskStatusInline'
import { AppIcon } from '@/components/ui/icons'
import { apiFetch } from '@/lib/api-fetch'
import { readApiErrorMessage } from '@/lib/api/read-error-message'
import { queryKeys } from '@/lib/query/keys'
import { useTaskStatus } from '@/lib/query/hooks/useTaskStatus'
import { resolveTaskPresentationState } from '@/lib/task/presentation'
import { useWorkspaceStageRuntime } from '../WorkspaceStageRuntimeContext'
import { useWorkspaceProvider } from '../WorkspaceProvider'

type ComposeProjectResponse = {
  id?: string
  episodeId?: string
  projectData?: unknown
  renderStatus?: 'pending' | 'rendering' | 'completed' | 'failed' | string | null
  renderTaskId?: string | null
  outputUrl?: string | null
  errorCode?: string | null
  errorMessage?: string | null
  updatedAt?: string | Date | null
}

function composeQueryKey(projectId: string, episodeId: string) {
  return ['novel-promotion-compose', projectId, episodeId] as const
}

export default function ComposeStageRoute() {
  const t = useTranslations('video')
  const runtime = useWorkspaceStageRuntime()
  const { projectId, episodeId } = useWorkspaceProvider()
  const queryClient = useQueryClient()

  const composeQuery = useQuery({
    queryKey: episodeId ? composeQueryKey(projectId, episodeId) : ['novel-promotion-compose', projectId, ''],
    enabled: !!episodeId,
    refetchInterval: 3000,
    queryFn: async () => {
      const search = new URLSearchParams({ episodeId: episodeId! })
      const res = await apiFetch(`/api/novel-promotion/${projectId}/compose?${search}`)
      if (!res.ok) throw new Error(await readApiErrorMessage(res, t('compose.loadFailed')))
      return await res.json() as ComposeProjectResponse
    },
  })

  const composeMutation = useMutation({
    mutationFn: async () => {
      if (!episodeId) throw new Error(t('compose.noEpisode'))
      const res = await apiFetch(`/api/novel-promotion/${projectId}/compose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId }),
      })
      if (!res.ok) throw new Error(await readApiErrorMessage(res, t('compose.startFailed')))
      return await res.json() as ComposeProjectResponse
    },
    onSuccess: async () => {
      if (!episodeId) return
      await queryClient.invalidateQueries({ queryKey: composeQueryKey(projectId, episodeId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId) })
    },
  })

  const composeProject = composeQuery.data
  const taskStatus = useTaskStatus({
    projectId,
    targetType: 'VideoEditorProject',
    targetId: composeProject?.id || null,
    type: ['video_compose'],
    enabled: !!composeProject?.id,
  })

  const isTaskActive = taskStatus.data?.hasActive === true
  const isRendering = composeProject?.renderStatus === 'pending'
    || composeProject?.renderStatus === 'rendering'
    || isTaskActive
    || composeMutation.isPending
  const progress = taskStatus.data?.latest?.progress ?? (isRendering ? 5 : null)
  const lastError = composeProject?.errorMessage
    || taskStatus.data?.lastFailed?.message
    || taskStatus.data?.latest?.errorMessage
    || composeMutation.error?.message
    || null
  const failed = composeProject?.renderStatus === 'failed' || !!composeMutation.error
  const completed = composeProject?.renderStatus === 'completed' && !!composeProject.outputUrl
  const statusText = useMemo(() => {
    if (composeMutation.isPending) return t('compose.submitting')
    if (isRendering) return t('compose.rendering')
    if (completed) return t('compose.completed')
    if (failed) return t('compose.failed')
    return t('compose.notStarted')
  }, [completed, composeMutation.isPending, failed, isRendering, t])
  const taskState = resolveTaskPresentationState({
    phase: failed ? 'failed' : completed ? 'completed' : isRendering ? 'processing' : 'idle',
    intent: 'process',
    resource: 'video',
    hasOutput: completed,
  })

  if (!episodeId) return null

  return (
    <div className="space-y-6 pb-20">
      <div className="glass-surface p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[var(--glass-bg-muted)] text-[var(--glass-tone-info-fg)] flex items-center justify-center">
                <AppIcon name={completed ? 'badgeCheck' : 'film'} className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--glass-text-primary)]">{t('compose.title')}</h2>
                <p className="text-sm text-[var(--glass-text-secondary)]">{statusText}</p>
              </div>
            </div>
            {typeof progress === 'number' && (
              <div className="flex items-center gap-3 text-sm text-[var(--glass-text-tertiary)]">
                <TaskStatusInline state={taskState} className="[&>span]:sr-only" />
                <div className="h-2 w-56 max-w-full rounded-full bg-[var(--glass-bg-muted)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--glass-tone-info-fg)] transition-all"
                    style={{ width: `${Math.max(3, Math.min(100, progress))}%` }}
                  />
                </div>
                <span>{Math.floor(progress)}%</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => runtime.onStageChange('videos')}
              className="glass-btn-base glass-btn-secondary px-4 py-2 text-sm font-medium flex items-center gap-2"
            >
              <AppIcon name="chevronLeft" className="h-4 w-4" />
              <span>{t('compose.backToVideos')}</span>
            </button>
            <button
              type="button"
              onClick={() => { void composeMutation.mutateAsync() }}
              disabled={isRendering}
              className="glass-btn-base glass-btn-primary px-4 py-2 text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRendering ? (
                <AppIcon name="loader" className="h-4 w-4 animate-spin" />
              ) : (
                <AppIcon name={composeProject?.id ? 'refresh' : 'play'} className="h-4 w-4" />
              )}
              <span>{composeProject?.id ? t('compose.recompose') : t('compose.start')}</span>
            </button>
          </div>
        </div>
      </div>

      {(failed || lastError) && (
        <div className="glass-surface p-4 border border-[var(--glass-tone-danger-border)] text-[var(--glass-tone-danger-fg)]">
          <div className="flex items-start gap-3">
            <AppIcon name="alert" className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold">{t('compose.failedReason')}</div>
              <div className="text-sm mt-1 break-words">{lastError || t('compose.failedFallback')}</div>
            </div>
          </div>
        </div>
      )}

      <div className="glass-surface p-5">
        {completed && composeProject.outputUrl ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-[var(--glass-text-primary)]">{t('compose.previewTitle')}</h3>
              <a
                href={composeProject.outputUrl}
                download
                className="glass-btn-base glass-btn-tone-info px-4 py-2 text-sm font-medium flex items-center gap-2"
              >
                <AppIcon name="download" className="h-4 w-4" />
                <span>{t('compose.download')}</span>
              </a>
            </div>
            <video
              controls
              src={composeProject.outputUrl}
              className="w-full max-h-[70vh] rounded-lg bg-black"
            />
          </div>
        ) : (
          <div className="py-14 text-center text-[var(--glass-text-secondary)]">
            <AppIcon name={isRendering ? 'loader' : 'film'} className={`mx-auto mb-3 h-8 w-8 ${isRendering ? 'animate-spin' : ''}`} />
            <p>{isRendering ? t('compose.waitingPreview') : t('compose.empty')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
