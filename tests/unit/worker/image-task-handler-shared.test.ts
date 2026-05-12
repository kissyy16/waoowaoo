import { beforeEach, describe, expect, it, vi } from 'vitest'

const utilsMock = vi.hoisted(() => ({
  resolveImageSourceFromGeneration: vi.fn(),
  toSignedUrlIfCos: vi.fn((value: unknown) => (
    typeof value === 'string' && value.trim() ? `signed:${value}` : null
  )),
  uploadImageSourceToCos: vi.fn(),
  withLabelBar: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    novelPromotionProject: {
      findUnique: vi.fn(),
    },
  },
}))
vi.mock('@/lib/workers/utils', () => utilsMock)

import {
  collectPanelReferenceImages,
  parseNameReferenceArray,
} from '@/lib/workers/handlers/image-task-handler-shared'

describe('image-task-handler-shared panel references', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('collects sketch, character, location, and prop reference images for panel generation', async () => {
    const refs = await collectPanelReferenceImages({
      characters: [
        {
          name: 'Hero',
          appearances: [
            {
              changeReason: 'default',
              imageUrl: 'cos/hero-fallback.png',
              imageUrls: JSON.stringify(['cos/hero-a.png', 'cos/hero-selected.png']),
              selectedIndex: 1,
            },
          ],
        },
      ],
      locations: [
        {
          name: 'Old Town',
          assetKind: 'location',
          selectedImageId: 'location-image-2',
          images: [
            {
              id: 'location-image-1',
              isSelected: true,
              imageUrl: 'cos/location-old.png',
            },
            {
              id: 'location-image-2',
              isSelected: false,
              imageUrl: 'cos/location-selected.png',
            },
          ],
        },
        {
          name: '亮黄色 smart 精灵#6',
          assetKind: 'prop',
          selectedImageId: 'prop-image-1',
          images: [
            {
              id: 'prop-image-1',
              isSelected: true,
              imageUrl: 'cos/prop-smart-6.png',
            },
          ],
        },
      ],
    }, {
      sketchImageUrl: 'cos/sketch.png',
      characters: JSON.stringify([{ name: 'Hero', appearance: 'default' }]),
      location: 'Old Town',
      props: JSON.stringify(['亮黄色 smart 精灵#6']),
    })

    expect(refs).toEqual([
      'signed:cos/sketch.png',
      'signed:cos/hero-selected.png',
      'signed:cos/location-selected.png',
      'signed:cos/prop-smart-6.png',
    ])
  })

  it('parses string and object name references without accepting invalid rows', () => {
    expect(parseNameReferenceArray(JSON.stringify([
      '亮黄色 smart 精灵#6',
      { name: '钥匙' },
      { title: 'ignored' },
      42,
      '',
    ]))).toEqual(['亮黄色 smart 精灵#6', '钥匙'])
  })
})
