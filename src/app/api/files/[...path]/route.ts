import { logError as _ulogError } from '@/lib/logging/core'
/**
 * 本地文件服务API
 * 
 * 仅在 STORAGE_TYPE=local 时使用
 * 提供本地文件的HTTP访问服务
 */

import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './data/uploads'

// MIME类型映射
const MIME_TYPES: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.json': 'application/json',
    '.txt': 'text/plain',
}

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    return MIME_TYPES[ext] || 'application/octet-stream'
}

function parseRangeHeader(rangeHeader: string, size: number): { start: number; end: number } | null {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
    if (!match) return null

    const [, startValue, endValue] = match
    if (!startValue && !endValue) return null

    if (!startValue && endValue) {
        const suffixLength = Number.parseInt(endValue, 10)
        if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null
        return {
            start: Math.max(size - suffixLength, 0),
            end: size - 1,
        }
    }

    const start = Number.parseInt(startValue, 10)
    const end = endValue ? Number.parseInt(endValue, 10) : size - 1
    if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        end < start ||
        start >= size
    ) {
        return null
    }

    return {
        start,
        end: Math.min(end, size - 1),
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathSegments } = await params

        // 解码路径（因为URL编码过）
        const decodedPath = decodeURIComponent(pathSegments.join('/'))
        const filePath = path.join(process.cwd(), UPLOAD_DIR, decodedPath)

        // 安全检查：确保路径不会逃逸出上传目录
        const normalizedPath = path.normalize(filePath)
        const uploadDirPath = path.normalize(path.join(process.cwd(), UPLOAD_DIR))

        if (!normalizedPath.startsWith(uploadDirPath + path.sep)) {
            _ulogError(`[Files API] 路径逃逸尝试: ${decodedPath}`)
            return NextResponse.json({ error: 'Access denied' }, { status: 403 })
        }

        const stat = await fs.stat(filePath)
        const mimeType = getMimeType(filePath)
        const rangeHeader = request.headers.get('range')
        const baseHeaders = {
            'Content-Type': mimeType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000',
        }

        if (rangeHeader) {
            const range = parseRangeHeader(rangeHeader, stat.size)
            if (!range) {
                return new NextResponse(null, {
                    status: 416,
                    headers: {
                        ...baseHeaders,
                        'Content-Range': `bytes */${stat.size}`,
                    },
                })
            }

            const buffer = await fs.readFile(filePath)
            const chunk = buffer.subarray(range.start, range.end + 1)
            return new NextResponse(new Uint8Array(chunk), {
                status: 206,
                headers: {
                    ...baseHeaders,
                    'Content-Length': chunk.length.toString(),
                    'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
                },
            })
        }

        // 读取文件
        const buffer = await fs.readFile(filePath)

        // 返回文件内容
        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                ...baseHeaders,
                'Content-Length': buffer.length.toString(),
            },
        })

    } catch (error: unknown) {
        const code = typeof error === 'object' && error !== null && 'code' in error
            ? (error as { code?: unknown }).code
            : undefined
        if (code === 'ENOENT') {
            return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }

        _ulogError('[Files API] 读取文件失败:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
