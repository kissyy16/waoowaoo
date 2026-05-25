import { describe, expect, it, vi } from 'vitest'
import { submitTask } from '@/lib/task/submitter'
import { TASK_STATUS, TASK_TYPE } from '@/lib/task/types'

const addTaskJobMock = vi.hoisted(() => vi.fn(async () => ({ id: 'job-1' })))
const publishTaskEventMock = vi.hoisted(() => vi.fn(async () => ({})))
const createTaskMock = vi.hoisted(() => vi.fn(async () => ({
  task: {
    id: 'task-1',
    status: 'queued',
    payload: {},
    billingInfo: null,
    priority: 0,
  },
  deduped: false,
})))
const markTaskEnqueuedMock = vi.hoisted(() => vi.fn(async () => ({})))
const loggerWarnMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logging/core', () => ({
  createScopedLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: loggerWarnMock,
  }),
}))

vi.mock('@/lib/task/queues', () => ({
  addTaskJob: addTaskJobMock,
}))

vi.mock('@/lib/task/publisher', () => ({
  publishTaskEvent: publishTaskEventMock,
}))

vi.mock('@/lib/task/service', () => ({
  createTask: createTaskMock,
  getTaskById: vi.fn(),
  markTaskEnqueueFailed: vi.fn(),
  markTaskEnqueued: markTaskEnqueuedMock,
  markTaskFailed: vi.fn(),
  rollbackTaskBillingForTask: vi.fn(),
  updateTaskBillingInfo: vi.fn(),
  updateTaskPayload: vi.fn(),
}))

vi.mock('@/lib/billing', () => ({
  buildDefaultTaskBillingInfo: vi.fn(() => null),
  InsufficientBalanceError: class InsufficientBalanceError extends Error {},
  isBillableTaskType: vi.fn(() => true),
  prepareTaskBilling: vi.fn(),
}))

vi.mock('@/lib/llm-observe/stage-pipeline', () => ({
  getTaskFlowMeta: () => ({
    flowId: 'test-flow',
    flowStageIndex: 1,
    flowStageTitle: 'Test',
    flowStageTotal: 1,
  }),
}))

vi.mock('@/lib/run-runtime/service', () => ({
  attachTaskToRun: vi.fn(),
  createRun: vi.fn(),
  findReusableActiveRun: vi.fn(async () => null),
}))

vi.mock('@/lib/run-runtime/workflow', () => ({
  isAiTaskType: vi.fn(() => false),
  workflowTypeFromTaskType: vi.fn((type) => type),
}))

describe('submitTask billingInfo fallback', () => {
  it('allows a billable task without computed billingInfo', async () => {
    const result = await submitTask({
      userId: 'user-1',
      locale: 'zh',
      projectId: 'project-1',
      type: TASK_TYPE.IMAGE_CHARACTER,
      targetType: 'CharacterAppearance',
      targetId: 'appearance-1',
      payload: {},
    })

    expect(result).toMatchObject({
      success: true,
      async: true,
      taskId: 'task-1',
      status: TASK_STATUS.QUEUED,
    })
    expect(markTaskEnqueuedMock).toHaveBeenCalledWith('task-1')
    expect(addTaskJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        billingInfo: null,
        taskId: 'task-1',
      }),
      expect.any(Object),
    )
    expect(publishTaskEventMock).toHaveBeenCalled()
    expect(loggerWarnMock).toHaveBeenCalledWith(expect.objectContaining({
      action: 'task.submit.billing_info_missing',
    }))
  })
})
