/**
 * 主形象的 appearanceIndex 值。
 * 所有判断主/子形象的逻辑必须引用此常量，禁止硬编码数字。
 * 子形象的 appearanceIndex 从 PRIMARY_APPEARANCE_INDEX + 1 开始递增。
 */
export const PRIMARY_APPEARANCE_INDEX = 0

// 比例配置（nanobanana 支持的所有比例，按常用程度排序）
export const ASPECT_RATIO_CONFIGS: Record<string, { label: string; isVertical: boolean }> = {
  '16:9': { label: '16:9', isVertical: false },
  '9:16': { label: '9:16', isVertical: true },
  '1:1': { label: '1:1', isVertical: false },
  '3:2': { label: '3:2', isVertical: false },
  '2:3': { label: '2:3', isVertical: true },
  '4:3': { label: '4:3', isVertical: false },
  '3:4': { label: '3:4', isVertical: true },
  '5:4': { label: '5:4', isVertical: false },
  '4:5': { label: '4:5', isVertical: true },
  '21:9': { label: '21:9', isVertical: false },
}

// 配置页面使用的选项列表（从 ASPECT_RATIO_CONFIGS 派生）
export const VIDEO_RATIOS = Object.entries(ASPECT_RATIO_CONFIGS).map(([value, config]) => ({
  value,
  label: config.label
}))

// 获取比例配置
export function getAspectRatioConfig(ratio: string) {
  return ASPECT_RATIO_CONFIGS[ratio] || ASPECT_RATIO_CONFIGS['16:9']
}

export const ANALYSIS_MODELS = [
  { value: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { value: 'google/gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash-Lite' },
  { value: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' }
]

export const IMAGE_MODELS = [
  { value: 'doubao-seedream-4-5-251128', label: 'Seedream 4.5' },
  { value: 'doubao-seedream-4-0-250828', label: 'Seedream 4.0' }
]

// 图像模型选项（ 生成完整图片）
export const IMAGE_MODEL_OPTIONS = [
  { value: 'banana', label: 'Banana Pro (FAL)' },
  { value: 'banana-2', label: 'Banana 2 (FAL)' },
  { value: 'gemini-3-pro-image-preview', label: 'Banana (Google)' },
  { value: 'gemini-3-pro-image-preview-batch', label: 'Banana (Google Batch) 省50%' },
  { value: 'doubao-seedream-4-0-250828', label: 'Seedream 4.0' },
  { value: 'doubao-seedream-4-5-251128', label: 'Seedream 4.5' },
  { value: 'imagen-4.0-generate-001', label: 'Imagen 4.0 (Google)' },
  { value: 'imagen-4.0-ultra-generate-001', label: 'Imagen 4.0 Ultra' },
  { value: 'imagen-4.0-fast-generate-001', label: 'Imagen 4.0 Fast' }
]

// Banana 模型分辨率选项（仅用于九宫格分镜图，单张生成固定2K）
export const BANANA_RESOLUTION_OPTIONS = [
  { value: '2K', label: '2K (推荐，快速)' },
  { value: '4K', label: '4K (高清，较慢)' }
]

// 支持分辨率选择的 Banana 模型
export const BANANA_MODELS = ['banana', 'banana-2', 'gemini-3-pro-image-preview', 'gemini-3-pro-image-preview-batch']

export const VIDEO_MODELS = [
  { value: 'doubao-seedance-2-0-260128', label: 'Seedance 2.0' },
  { value: 'doubao-seedance-2-0-fast-260128', label: 'Seedance 2.0 Fast' },
  { value: 'doubao-seedance-1-0-pro-fast-251015', label: 'Seedance 1.0 Pro Fast' },
  { value: 'doubao-seedance-1-0-pro-fast-251015-batch', label: 'Seedance 1.0 Pro Fast (批量) 省50%' },
  { value: 'doubao-seedance-1-0-lite-i2v-250428', label: 'Seedance 1.0 Lite' },
  { value: 'doubao-seedance-1-0-lite-i2v-250428-batch', label: 'Seedance 1.0 Lite (批量) 省50%' },
  { value: 'doubao-seedance-1-5-pro-251215', label: 'Seedance 1.5 Pro' },
  { value: 'doubao-seedance-1-5-pro-251215-batch', label: 'Seedance 1.5 Pro (批量) 省50%' },
  { value: 'doubao-seedance-1-0-pro-250528', label: 'Seedance 1.0 Pro' },
  { value: 'doubao-seedance-1-0-pro-250528-batch', label: 'Seedance 1.0 Pro (批量) 省50%' },
  { value: 'fal-wan25', label: 'Wan 2.6' },
  { value: 'fal-veo31', label: 'Veo 3.1 Fast' },
  { value: 'fal-sora2', label: 'Sora 2' },
  { value: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video', label: 'Kling 2.5 Turbo Pro' },
  { value: 'fal-ai/kling-video/v3/standard/image-to-video', label: 'Kling 3 Standard' },
  { value: 'fal-ai/kling-video/v3/pro/image-to-video', label: 'Kling 3 Pro' }
]

// SeeDream 批量模型列表（使用 GPU 空闲时间，成本降低50%）
export const SEEDANCE_BATCH_MODELS = [
  'doubao-seedance-1-5-pro-251215-batch',
  'doubao-seedance-1-0-pro-250528-batch',
  'doubao-seedance-1-0-pro-fast-251015-batch',
  'doubao-seedance-1-0-lite-i2v-250428-batch',
]

// 支持生成音频的模型
export const AUDIO_SUPPORTED_MODELS = [
  'doubao-seedance-2-0-260128',
  'doubao-seedance-2-0-fast-260128',
  'doubao-seedance-1-5-pro-251215',
  'doubao-seedance-1-5-pro-251215-batch',
]

// 首尾帧视频模型（能力权威来源是 standards/capabilities；此常量仅作静态兜底展示）
export const FIRST_LAST_FRAME_MODELS = [
  { value: 'doubao-seedance-2-0-260128', label: 'Seedance 2.0 (首尾帧)' },
  { value: 'doubao-seedance-2-0-fast-260128', label: 'Seedance 2.0 Fast (首尾帧)' },
  { value: 'doubao-seedance-1-5-pro-251215', label: 'Seedance 1.5 Pro (首尾帧)' },
  { value: 'doubao-seedance-1-5-pro-251215-batch', label: 'Seedance 1.5 Pro (首尾帧/批量) 省50%' },
  { value: 'doubao-seedance-1-0-pro-250528', label: 'Seedance 1.0 Pro (首尾帧)' },
  { value: 'doubao-seedance-1-0-pro-250528-batch', label: 'Seedance 1.0 Pro (首尾帧/批量) 省50%' },
  { value: 'doubao-seedance-1-0-lite-i2v-250428', label: 'Seedance 1.0 Lite (首尾帧)' },
  { value: 'doubao-seedance-1-0-lite-i2v-250428-batch', label: 'Seedance 1.0 Lite (首尾帧/批量) 省50%' },
  { value: 'veo-3.1-generate-preview', label: 'Veo 3.1 (首尾帧)' },
  { value: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast (首尾帧)' }
]

export const VIDEO_RESOLUTIONS = [
  { value: '480p', label: '480p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' }
]

export const TTS_RATES = [
  { value: '+0%', label: '正常速度 (1.0x)' },
  { value: '+20%', label: '轻微加速 (1.2x)' },
  { value: '+50%', label: '加速 (1.5x)' },
  { value: '+100%', label: '快速 (2.0x)' }
]

export const TTS_VOICES = [
  { value: 'zh-CN-YunxiNeural', label: '云希 (男声)', preview: '男' },
  { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (女声)', preview: '女' },
  { value: 'zh-CN-YunyangNeural', label: '云扬 (男声)', preview: '男' },
  { value: 'zh-CN-XiaoyiNeural', label: '晓伊 (女声)', preview: '女' }
]

export const ART_STYLES = [
  {
    value: 'american-comic',
    label: '漫画风',
    preview: '漫',
    category: '动漫 / 漫画',
    featured: true,
    keywords: ['漫画', 'comic', '插画', '分镜'],
    promptZh: '漫画美术风格，清晰线条，夸张但自然的表情与动作，画面具有分镜感和强叙事性。',
    promptEn: 'Comic art style with clean linework, expressive but natural characters, strong panel-like storytelling and visual rhythm.'
  },
  {
    value: 'chinese-comic',
    label: '精致国漫',
    preview: '国',
    category: '动漫 / 漫画',
    featured: true,
    keywords: ['国漫', '中国动画', '2D'],
    promptZh: '现代高质量漫画风格，动漫风格，细节丰富精致，线条锐利干净，质感饱满，超清，干净的画面风格，2D风格，动漫风格。',
    promptEn: 'Modern premium Chinese comic style, rich details, clean sharp line art, full texture, ultra-clear 2D anime aesthetics.'
  },
  {
    value: 'japanese-anime',
    label: '日系动漫风',
    preview: '日',
    category: '动漫 / 漫画',
    featured: true,
    keywords: ['日漫', '动漫', 'anime', '赛璐璐'],
    promptZh: '现代日系动漫风格，赛璐璐上色，清晰干净的线条，视觉小说CG感。高质量2D风格',
    promptEn: 'Modern Japanese anime style, cel shading, clean line art, visual-novel CG look, high-quality 2D style.'
  },
  {
    value: 'realistic',
    label: '真人风格',
    preview: '实',
    category: '真人 / 影视',
    featured: true,
    keywords: ['真人', '写实', 'live action', 'realistic'],
    promptZh: '真实电影级画面质感，真实现实场景，色彩饱满通透，画面干净精致，真实感',
    promptEn: 'Realistic cinematic look, real-world scene fidelity, rich transparent colors, clean and refined image quality.'
  },
  {
    value: 'pixar-3d',
    label: '皮克斯3D',
    preview: '3D',
    category: '3D / CG',
    featured: true,
    keywords: ['皮克斯', '3D', '动画电影', '卡通'],
    promptZh: '皮克斯动画质感的3D卡通电影风格，角色表情生动，造型圆润可爱，柔和电影级灯光，细腻材质，明亮温暖色彩，高质量3D渲染。',
    promptEn: 'Pixar-style 3D animated film look, expressive characters, rounded appealing shapes, soft cinematic lighting, detailed materials, bright warm colors, high-quality 3D render.'
  },
  {
    value: 'cinematic',
    label: '电影质感',
    preview: '影',
    category: '真人 / 影视',
    featured: true,
    keywords: ['电影', 'cinematic', '胶片', '镜头'],
    promptZh: '电影级影像质感，精心设计的镜头语言，层次丰富的光影，高动态范围，具有影院级叙事氛围。',
    promptEn: 'Cinematic image quality with deliberate camera language, rich lighting layers, high dynamic range, and theatrical storytelling atmosphere.'
  },
  {
    value: 'ink-animation',
    label: '水墨动画风',
    preview: '墨',
    category: '国风 / 东方美术',
    featured: true,
    keywords: ['水墨', '国风', '山水', '墨色'],
    promptZh: '中国水墨动画风格，墨色晕染，留白构图，笔触灵动，画面具有东方诗意和流动感。',
    promptEn: 'Chinese ink animation style with soft ink diffusion, spacious composition, lively brushwork, and poetic Eastern movement.'
  },
  {
    value: 'xianxia',
    label: '古风仙侠风',
    preview: '侠',
    category: '国风 / 东方美术',
    featured: true,
    keywords: ['古风', '仙侠', '武侠', '东方奇幻'],
    promptZh: '古风仙侠影像风格，飘逸服饰，东方奇幻场景，云雾、法术光效与唯美电影级构图。',
    promptEn: 'Ancient Chinese xianxia fantasy style with flowing costumes, Eastern fantasy settings, mist, magical light effects, and elegant cinematic composition.'
  },
  {
    value: 'sci-fi-film',
    label: '科幻电影风',
    preview: '科',
    category: '科幻 / 奇幻 / 特效',
    featured: true,
    keywords: ['科幻', '未来', '太空', 'sci-fi'],
    promptZh: '科幻电影美术风格，未来科技环境，硬表面设计，冷暖对比光效，具有宏大而可信的未来感。',
    promptEn: 'Science-fiction film art direction with futuristic technology, hard-surface design, contrasting light, and a grand believable future atmosphere.'
  },
  {
    value: 'cyberpunk',
    label: '赛博朋克风',
    preview: '赛',
    category: '科幻 / 奇幻 / 特效',
    featured: true,
    keywords: ['赛博', '霓虹', '未来城市', 'cyberpunk'],
    promptZh: '赛博朋克影视风格，霓虹灯、雨夜街道、高密度未来城市，强烈色彩对比和科技颓废氛围。',
    promptEn: 'Cyberpunk film style with neon lights, rainy night streets, dense futuristic cities, strong color contrast, and techno-noir atmosphere.'
  },
  {
    value: 'storybook-illustration',
    label: '绘本插画风',
    preview: '绘',
    category: '绘本 / 艺术表达',
    featured: true,
    keywords: ['绘本', '插画', '儿童', '童话'],
    promptZh: '绘本插画风格，柔和色彩，温暖手绘质感，简洁构图，适合童话和轻叙事内容。',
    promptEn: 'Storybook illustration style with soft colors, warm hand-drawn texture, simple composition, suitable for fairy tales and gentle narratives.'
  },
  {
    value: 'game-cg',
    label: '游戏CG风',
    preview: '游',
    category: '3D / CG',
    featured: true,
    keywords: ['游戏', 'CG', '概念美术', '宣传片'],
    promptZh: '游戏CG宣传片风格，强戏剧光影，角色与场景细节丰富，动作张力强，画面具有高品质游戏过场动画质感。',
    promptEn: 'Game CG trailer style with dramatic lighting, richly detailed characters and environments, strong action tension, and premium cutscene quality.'
  },
  {
    value: 'korean-webtoon',
    label: '韩漫风',
    preview: '韩',
    category: '动漫 / 漫画',
    keywords: ['韩漫', 'webtoon', '条漫'],
    promptZh: '韩式 Webtoon 漫画风格，精致人物造型，柔和光影，清爽线条，画面适合竖屏连续叙事。',
    promptEn: 'Korean webtoon style with refined character design, soft lighting, clean linework, and vertical-scroll storytelling appeal.'
  },
  {
    value: 'american-superhero-comic',
    label: '美式漫画风',
    preview: '美',
    category: '动漫 / 漫画',
    keywords: ['美漫', '超级英雄', 'comic', '粗线条'],
    promptZh: '美式漫画风格，粗犷有力的线条，高反差阴影，英雄式动态构图，色彩鲜明且冲击力强。',
    promptEn: 'American comic-book style with bold powerful linework, high-contrast shadows, heroic dynamic composition, vivid colors, and strong impact.'
  },
  {
    value: 'painted-comic',
    label: '厚涂漫画风',
    preview: '涂',
    category: '动漫 / 漫画',
    keywords: ['厚涂', '漫画', '半写实'],
    promptZh: '厚涂漫画风格，半写实人物塑造，色块厚实，光影层次明显，兼具插画质感与漫画叙事。',
    promptEn: 'Painterly comic style with semi-realistic characters, solid color blocks, layered lighting, and both illustration texture and comic storytelling.'
  },
  {
    value: 'cel-animation',
    label: '赛璐璐动画风',
    preview: '璐',
    category: '动漫 / 漫画',
    keywords: ['赛璐璐', '2D动画', '动漫'],
    promptZh: '传统赛璐璐动画风格，清晰描线，平涂阴影，高饱和但干净的色彩，具有经典二维动画感。',
    promptEn: 'Traditional cel animation style with clean outlines, flat shaded lighting, saturated but clean colors, and classic 2D animation feel.'
  },
  {
    value: 'moe-anime',
    label: '二次元萌系',
    preview: '萌',
    category: '动漫 / 漫画',
    keywords: ['二次元', '萌系', '可爱', 'anime'],
    promptZh: '二次元萌系动画风格，角色可爱灵动，大眼睛与柔和表情，明亮清新的色彩与轻松氛围。',
    promptEn: 'Cute moe anime style with lively adorable characters, large expressive eyes, soft expressions, bright fresh colors, and a light atmosphere.'
  },
  {
    value: 'shonen-anime',
    label: '热血少年漫',
    preview: '燃',
    category: '动漫 / 漫画',
    keywords: ['少年漫', '热血', '战斗', 'anime'],
    promptZh: '热血少年漫画风格，动态构图，强烈速度线和动作张力，角色表情坚定，战斗氛围鲜明。',
    promptEn: 'Shonen battle anime style with dynamic composition, strong speed lines, intense action tension, determined expressions, and heroic energy.'
  },
  {
    value: 'watercolor-animation',
    label: '水彩动画风',
    preview: '彩',
    category: '动漫 / 漫画',
    keywords: ['水彩', '动画', '柔和'],
    promptZh: '水彩动画风格，透明叠色，纸张纹理，柔和边缘，画面轻盈温暖并带有手工感。',
    promptEn: 'Watercolor animation style with translucent color layers, paper texture, soft edges, and a light handmade warmth.'
  },
  {
    value: 'hand-drawn-animation',
    label: '手绘动画风',
    preview: '手',
    category: '动漫 / 漫画',
    keywords: ['手绘', '动画', '线稿'],
    promptZh: '手绘动画风格，保留自然笔触和线条抖动，质朴生动，具有传统手工动画的温度。',
    promptEn: 'Hand-drawn animation style with natural brush marks and subtle line wobble, vivid handmade warmth, and traditional animation charm.'
  },
  {
    value: 'black-white-manga',
    label: '黑白漫画风',
    preview: '黑',
    category: '动漫 / 漫画',
    keywords: ['黑白', '漫画', '网点'],
    promptZh: '黑白漫画风格，强烈明暗关系，网点与排线质感，构图具有漫画分镜冲击力。',
    promptEn: 'Black-and-white manga style with strong contrast, screentone and hatching texture, and impactful panel composition.'
  },
  {
    value: 'retro-animation',
    label: '复古动画风',
    preview: '复',
    category: '动漫 / 漫画',
    keywords: ['复古', '动画', '怀旧'],
    promptZh: '复古动画风格，怀旧配色，胶片颗粒，简洁造型，具有上世纪手绘动画的温暖年代感。',
    promptEn: 'Retro animation style with nostalgic colors, film grain, simplified shapes, and warm vintage hand-drawn animation character.'
  },
  {
    value: 'disney-3d',
    label: '迪士尼3D',
    preview: '迪',
    category: '3D / CG',
    keywords: ['迪士尼', '3D', '动画电影'],
    promptZh: '迪士尼动画电影式3D风格，优雅角色造型，明快色彩，流畅表演，童话般的电影级灯光。',
    promptEn: 'Disney-like 3D animated film style with elegant character design, bright colors, fluid acting, and fairy-tale cinematic lighting.'
  },
  {
    value: 'dreamworks-animation',
    label: '梦工厂动画风',
    preview: '梦',
    category: '3D / CG',
    keywords: ['梦工厂', '3D', '喜剧动画'],
    promptZh: '梦工厂动画电影风格，夸张表情，幽默动作节奏，鲜明角色轮廓和高质量3D动画质感。',
    promptEn: 'DreamWorks-like animated film style with exaggerated expressions, humorous motion rhythm, bold silhouettes, and high-quality 3D animation.'
  },
  {
    value: 'clay-animation',
    label: '黏土动画风',
    preview: '泥',
    category: '3D / CG',
    keywords: ['黏土', '定格', '手工'],
    promptZh: '黏土动画风格，手工塑形质感，可见细微指纹和材质痕迹，灯光柔和，画面温暖可触摸。',
    promptEn: 'Clay animation style with handmade sculpted texture, subtle fingerprints and material marks, soft lighting, and tactile warmth.'
  },
  {
    value: 'stop-motion',
    label: '定格动画风',
    preview: '格',
    category: '3D / CG',
    keywords: ['定格', 'stop motion', '手工模型'],
    promptZh: '定格动画风格，微缩模型场景，手工道具质感，逐帧动画的轻微停顿感和真实灯光。',
    promptEn: 'Stop-motion animation style with miniature sets, handmade props, subtle frame-by-frame motion feel, and practical lighting.'
  },
  {
    value: 'chibi-3d',
    label: 'Q版3D',
    preview: 'Q',
    category: '3D / CG',
    keywords: ['Q版', '3D', '可爱'],
    promptZh: 'Q版3D卡通风格，头身比例可爱，造型圆润，表情夸张，明亮柔和的动画渲染。',
    promptEn: 'Chibi 3D cartoon style with cute proportions, rounded shapes, exaggerated expressions, and bright soft animation rendering.'
  },
  {
    value: 'toy-3d',
    label: '玩具质感3D',
    preview: '玩',
    category: '3D / CG',
    keywords: ['玩具', '3D', '塑料', '模型'],
    promptZh: '玩具质感3D风格，塑料或树脂材质，微缩模型比例，干净棚拍灯光，画面精致有收藏品感。',
    promptEn: 'Toy-like 3D style with plastic or resin materials, miniature model proportions, clean studio lighting, and collectible polish.'
  },
  {
    value: 'realistic-3d',
    label: '写实3D',
    preview: '写',
    category: '3D / CG',
    keywords: ['写实', '3D', 'PBR'],
    promptZh: '写实3D渲染风格，PBR材质，真实光照和细节，场景具有高端CG短片质感。',
    promptEn: 'Realistic 3D render style with PBR materials, physically plausible lighting and detail, and premium CG short-film quality.'
  },
  {
    value: 'unreal-engine',
    label: '虚幻引擎风',
    preview: '虚',
    category: '3D / CG',
    keywords: ['虚幻引擎', 'unreal', '实时渲染'],
    promptZh: '虚幻引擎实时渲染风格，电影级环境光，精细材质，高保真场景与游戏预告片质感。',
    promptEn: 'Unreal Engine real-time render style with cinematic ambient lighting, detailed materials, high-fidelity environments, and game trailer polish.'
  },
  {
    value: 'cinematic-cgi',
    label: '电影级CGI',
    preview: 'CG',
    category: '3D / CG',
    keywords: ['CGI', '电影', '特效'],
    promptZh: '电影级CGI风格，真实特效合成，高精度模型和材质，光影与摄影机运动具有大片质感。',
    promptEn: 'Feature-film CGI style with realistic VFX compositing, high-detail models and materials, blockbuster lighting and camera motion.'
  },
  {
    value: 'toon-shaded-3d',
    label: '卡通渲染3D',
    preview: '卡',
    category: '3D / CG',
    keywords: ['卡通渲染', 'toon', '3D'],
    promptZh: '3D卡通渲染风格，模型立体但边缘描线清晰，色块干净，兼具2D动画观感和3D空间感。',
    promptEn: 'Toon-shaded 3D style with dimensional models, clear outlines, clean color blocks, combining 2D animation feel and 3D space.'
  },
  {
    value: 'hollywood-blockbuster',
    label: '好莱坞大片风',
    preview: '大',
    category: '真人 / 影视',
    keywords: ['好莱坞', '大片', '动作'],
    promptZh: '好莱坞大片风格，宏大场面，强烈戏剧光效，动态摄影，画面节奏紧张且制作规格高。',
    promptEn: 'Hollywood blockbuster style with grand scale, dramatic lighting, dynamic camera work, tense pacing, and high production value.'
  },
  {
    value: 'short-film-drama',
    label: '剧情短片风',
    preview: '剧',
    category: '真人 / 影视',
    keywords: ['剧情', '短片', '人物'],
    promptZh: '剧情短片影像风格，关注人物表演和情绪，真实自然光，克制构图，生活化但有电影感。',
    promptEn: 'Narrative short-film style focused on acting and emotion, natural light, restrained composition, grounded yet cinematic.'
  },
  {
    value: 'documentary',
    label: '纪录片风',
    preview: '纪',
    category: '真人 / 影视',
    keywords: ['纪录片', '真实', '观察'],
    promptZh: '纪录片影像风格，真实观察感，手持或自然摄影，环境细节丰富，画面不过度修饰。',
    promptEn: 'Documentary style with authentic observational feeling, handheld or natural cinematography, rich environmental detail, and minimal polish.'
  },
  {
    value: 'commercial',
    label: '广告片风',
    preview: '广',
    category: '真人 / 影视',
    keywords: ['广告', '商业', '产品'],
    promptZh: '商业广告片风格，画面干净高级，产品或主体突出，光线精致，节奏明快且视觉记忆点强。',
    promptEn: 'Commercial film style with clean premium visuals, prominent subject or product, refined lighting, brisk rhythm, and strong visual hooks.'
  },
  {
    value: 'music-video',
    label: 'MV音乐视频风',
    preview: 'MV',
    category: '真人 / 影视',
    keywords: ['MV', '音乐', '节奏', '舞台'],
    promptZh: '音乐视频风格，强节奏镜头，舞台化光影，色彩鲜明，画面具有情绪化和表演感。',
    promptEn: 'Music video style with rhythmic shots, stage-like lighting, vivid colors, emotional energy, and performance-driven visuals.'
  },
  {
    value: 'tv-drama',
    label: '电视剧质感',
    preview: '视',
    category: '真人 / 影视',
    keywords: ['电视剧', '连续剧', '现实'],
    promptZh: '电视剧影像质感，清晰稳定的叙事镜头，自然表演，真实场景，适合连续剧情推进。',
    promptEn: 'TV drama look with clear stable narrative shots, natural acting, realistic locations, and continuity-friendly storytelling.'
  },
  {
    value: 'social-realism',
    label: '现实主义影像',
    preview: '现',
    category: '真人 / 影视',
    keywords: ['现实主义', '生活', '真实'],
    promptZh: '现实主义影像风格，生活化场景，朴素自然光，克制色彩，突出真实人物处境与情绪。',
    promptEn: 'Social realism style with everyday locations, plain natural light, restrained colors, and emphasis on real human situations and emotion.'
  },
  {
    value: 'photographic',
    label: '写实摄影风',
    preview: '摄',
    category: '真人 / 影视',
    keywords: ['摄影', '写实', 'photo'],
    promptZh: '写实摄影风格，真实镜头成像，准确曝光，细节自然，画面像高质量实拍照片。',
    promptEn: 'Photographic realism with real lens rendering, accurate exposure, natural detail, and high-quality live-shot photo feel.'
  },
  {
    value: 'fashion-editorial',
    label: '时尚大片风',
    preview: '尚',
    category: '真人 / 影视',
    keywords: ['时尚', '大片', '杂志'],
    promptZh: '时尚大片影像风格，精致妆造，优雅姿态，高级布光，杂志封面般的视觉冲击。',
    promptEn: 'Fashion editorial film style with refined styling, elegant poses, premium lighting, and magazine-cover visual impact.'
  },
  {
    value: 'vintage-film',
    label: '复古胶片风',
    preview: '胶',
    category: '真人 / 影视',
    keywords: ['复古', '胶片', 'film grain'],
    promptZh: '复古胶片风格，柔和颗粒，轻微褪色，温暖或怀旧色调，具有模拟电影摄影质感。',
    promptEn: 'Vintage film look with soft grain, slight fading, warm or nostalgic tones, and analog cinematography texture.'
  },
  {
    value: 'noir-film',
    label: '黑白电影风',
    preview: '白',
    category: '真人 / 影视',
    keywords: ['黑白', '电影', 'noir'],
    promptZh: '黑白电影风格，高反差光影，低调照明，经典电影构图，氛围神秘而克制。',
    promptEn: 'Black-and-white film style with high-contrast lighting, low-key illumination, classic composition, and restrained mystery.'
  },
  {
    value: 'hong-kong-cinema',
    label: '港片电影风',
    preview: '港',
    category: '真人 / 影视',
    keywords: ['港片', '香港电影', '霓虹', '警匪'],
    promptZh: '港片电影风格，城市霓虹、街巷烟火气，手持镜头张力，冷暖交错的怀旧影像。',
    promptEn: 'Hong Kong cinema style with urban neon, lively street texture, tense handheld shots, and nostalgic warm-cool color interplay.'
  },
  {
    value: 'wuxia-film',
    label: '武侠电影风',
    preview: '武',
    category: '真人 / 影视',
    keywords: ['武侠', '江湖', '动作'],
    promptZh: '武侠电影风格，江湖气质，飘逸动作，竹林、客栈或山水场景，光影具有东方古典美。',
    promptEn: 'Wuxia film style with martial world atmosphere, graceful action, bamboo forests, inns or landscapes, and classical Eastern lighting.'
  },
  {
    value: 'epic-fantasy',
    label: '奇幻史诗风',
    preview: '史',
    category: '科幻 / 奇幻 / 特效',
    keywords: ['奇幻', '史诗', '魔法'],
    promptZh: '奇幻史诗电影风格，宏大世界观，古老建筑和神秘魔法，画面壮阔且富有传奇感。',
    promptEn: 'Epic fantasy film style with grand worldbuilding, ancient architecture, mysterious magic, sweeping visuals, and legendary atmosphere.'
  },
  {
    value: 'magic-fantasy',
    label: '魔幻电影风',
    preview: '魔',
    category: '科幻 / 奇幻 / 特效',
    keywords: ['魔幻', '魔法', '幻想'],
    promptZh: '魔幻电影风格，魔法光效、异世界生物和神秘场景，色彩浓郁，氛围梦幻而危险。',
    promptEn: 'Magical fantasy film style with spell effects, otherworldly creatures, mysterious locations, rich colors, and dreamy danger.'
  },
  {
    value: 'post-apocalyptic',
    label: '末日废土风',
    preview: '废',
    category: '科幻 / 奇幻 / 特效',
    keywords: ['末日', '废土', '灾后'],
    promptZh: '末日废土影视风格，破败城市、荒漠尘土、粗粝材质，画面紧张压抑并带生存感。',
    promptEn: 'Post-apocalyptic wasteland style with ruined cities, desert dust, rugged materials, tense oppressive visuals, and survival atmosphere.'
  },
  {
    value: 'steampunk',
    label: '蒸汽朋克风',
    preview: '汽',
    category: '科幻 / 奇幻 / 特效',
    keywords: ['蒸汽朋克', '机械', '维多利亚'],
    promptZh: '蒸汽朋克风格，黄铜机械、齿轮、蒸汽管线与维多利亚服饰，复古工业幻想氛围。',
    promptEn: 'Steampunk style with brass machinery, gears, steam pipes, Victorian fashion, and retro-industrial fantasy atmosphere.'
  },
  {
    value: 'space-opera',
    label: '太空歌剧风',
    preview: '空',
    category: '科幻 / 奇幻 / 特效',
    keywords: ['太空', '星舰', '宇宙', 'space opera'],
    promptZh: '太空歌剧电影风格，巨型星舰、浩瀚宇宙、外星文明与史诗级光影，场面恢弘。',
    promptEn: 'Space opera film style with massive starships, vast cosmos, alien civilizations, epic lighting, and grand scale.'
  },
  {
    value: 'superhero-film',
    label: '超级英雄电影风',
    preview: '超',
    category: '科幻 / 奇幻 / 特效',
    keywords: ['超级英雄', '英雄', '特效'],
    promptZh: '超级英雄电影风格，英雄姿态，强烈逆光，城市灾难或战斗场面，画面充满力量感。',
    promptEn: 'Superhero film style with heroic poses, strong backlight, city-scale action or disaster scenes, and powerful visual energy.'
  },
  {
    value: 'kaiju-film',
    label: '怪兽电影风',
    preview: '怪',
    category: '科幻 / 奇幻 / 特效',
    keywords: ['怪兽', '灾难', '巨物'],
    promptZh: '怪兽电影风格，巨大生物尺度感，城市破坏、烟尘和强烈逆光，画面压迫感强。',
    promptEn: 'Kaiju monster film style with enormous creature scale, city destruction, smoke and dust, strong backlight, and intense pressure.'
  },
  {
    value: 'disaster-film',
    label: '灾难片风',
    preview: '灾',
    category: '科幻 / 奇幻 / 特效',
    keywords: ['灾难', '爆炸', '逃生'],
    promptZh: '灾难片风格，极端天气、坍塌、爆炸或逃生场面，镜头紧张，视觉冲击强。',
    promptEn: 'Disaster film style with extreme weather, collapse, explosions or escape scenes, tense camera work, and strong visual impact.'
  },
  {
    value: 'thriller',
    label: '悬疑惊悚风',
    preview: '悬',
    category: '科幻 / 奇幻 / 特效',
    keywords: ['悬疑', '惊悚', '阴影'],
    promptZh: '悬疑惊悚影视风格，低照度光影，不安构图，细节暗示，气氛紧绷但不过度血腥。',
    promptEn: 'Suspense thriller style with low-key lighting, unsettling composition, suggestive details, and tense atmosphere without excessive gore.'
  },
  {
    value: 'horror-film',
    label: '恐怖电影风',
    preview: '恐',
    category: '科幻 / 奇幻 / 特效',
    keywords: ['恐怖', '惊悚', '暗黑'],
    promptZh: '恐怖电影风格，阴暗空间，压迫光影，诡异细节和强烈未知感，营造恐惧氛围。',
    promptEn: 'Horror film style with dark spaces, oppressive lighting, eerie details, and a strong sense of the unknown.'
  },
  {
    value: 'guofeng-illustration',
    label: '国风插画风',
    preview: '风',
    category: '国风 / 东方美术',
    keywords: ['国风', '插画', '古风'],
    promptZh: '国风插画风格，中国传统元素与现代插画结合，色彩典雅，人物与场景精致唯美。',
    promptEn: 'Chinese guofeng illustration style combining traditional Chinese elements with modern illustration, elegant colors, refined characters and scenes.'
  },
  {
    value: 'new-chinese-cinema',
    label: '新中式电影风',
    preview: '中',
    category: '国风 / 东方美术',
    keywords: ['新中式', '电影', '东方'],
    promptZh: '新中式电影美术风格，东方建筑、简洁构图、克制色彩和现代电影摄影结合，高级含蓄。',
    promptEn: 'New Chinese cinematic style blending Eastern architecture, clean composition, restrained color, and modern cinematography.'
  },
  {
    value: 'eastern-fantasy',
    label: '东方奇幻风',
    preview: '东',
    category: '国风 / 东方美术',
    keywords: ['东方奇幻', '神话', '仙境'],
    promptZh: '东方奇幻风格，神话意象、仙境山水、灵兽与法术光效，画面瑰丽且具有东方文化气质。',
    promptEn: 'Eastern fantasy style with mythic imagery, celestial landscapes, spirit creatures, magical effects, and rich Eastern cultural atmosphere.'
  },
  {
    value: 'paper-cut-animation',
    label: '剪纸动画风',
    preview: '剪',
    category: '国风 / 东方美术',
    keywords: ['剪纸', '动画', '民间艺术'],
    promptZh: '剪纸动画风格，平面层叠纸张质感，民间艺术色彩，边缘清晰，画面具有手工舞台感。',
    promptEn: 'Paper-cut animation style with layered paper texture, folk-art colors, sharp edges, and handmade stage-like composition.'
  },
  {
    value: 'shadow-puppet',
    label: '皮影戏风',
    preview: '影',
    category: '国风 / 东方美术',
    keywords: ['皮影', '剪影', '传统'],
    promptZh: '皮影戏美术风格，半透明剪影人物，暖色背光，传统纹样，画面具有戏台和民俗感。',
    promptEn: 'Chinese shadow puppetry style with translucent silhouette figures, warm backlight, traditional patterns, and folk theater atmosphere.'
  },
  {
    value: 'dunhuang-mural',
    label: '敦煌壁画风',
    preview: '敦',
    category: '国风 / 东方美术',
    keywords: ['敦煌', '壁画', '飞天'],
    promptZh: '敦煌壁画美术风格，矿物色彩，飞天与纹样元素，古老壁画质感，画面庄重华丽。',
    promptEn: 'Dunhuang mural style with mineral pigments, apsara and ornamental motifs, ancient wall-painting texture, solemn and ornate visuals.'
  },
  {
    value: 'gongbi',
    label: '工笔画风',
    preview: '工',
    category: '国风 / 东方美术',
    keywords: ['工笔', '国画', '细腻'],
    promptZh: '工笔画风格，细密线条，精致设色，人物服饰与花鸟细节严谨，画面典雅端庄。',
    promptEn: 'Gongbi painting style with meticulous lines, refined colors, precise costume and floral details, elegant and formal composition.'
  },
  {
    value: 'shan-shui',
    label: '山水画风',
    preview: '山',
    category: '国风 / 东方美术',
    keywords: ['山水', '国画', '水墨'],
    promptZh: '中国山水画风格，远山云雾、留白与层次墨色，人物融入自然，画面宁静辽阔。',
    promptEn: 'Chinese landscape painting style with distant mountains, mist, negative space, layered ink tones, and quiet vastness.'
  },
  {
    value: 'kids-animation',
    label: '儿童动画风',
    preview: '童',
    category: '绘本 / 艺术表达',
    keywords: ['儿童', '动画', '可爱'],
    promptZh: '儿童动画风格，造型安全可爱，色彩明快，表情友好，画面简洁易懂且充满亲和力。',
    promptEn: 'Children animation style with safe cute shapes, bright colors, friendly expressions, simple readable visuals, and warmth.'
  },
  {
    value: 'oil-painting',
    label: '油画风',
    preview: '油',
    category: '绘本 / 艺术表达',
    keywords: ['油画', '绘画', '厚重'],
    promptZh: '油画艺术风格，厚重笔触，丰富色层，经典绘画光影，画面具有画布质感和艺术气息。',
    promptEn: 'Oil painting style with rich brush strokes, layered colors, classical painterly lighting, canvas texture, and artistic presence.'
  },
  {
    value: 'watercolor-painting',
    label: '水彩画风',
    preview: '水',
    category: '绘本 / 艺术表达',
    keywords: ['水彩', '绘画', '透明'],
    promptZh: '水彩画风格，透明色彩晕染，纸张纹理明显，边缘自然扩散，画面清透柔和。',
    promptEn: 'Watercolor painting style with transparent color blooms, visible paper texture, natural edge diffusion, and soft clarity.'
  },
  {
    value: 'sketch',
    label: '素描风',
    preview: '素',
    category: '绘本 / 艺术表达',
    keywords: ['素描', '铅笔', '线稿'],
    promptZh: '素描风格，铅笔线条与明暗排线，保留纸面质感，画面简洁专注于形体和光影。',
    promptEn: 'Sketch style with pencil linework and tonal hatching, paper texture, and simple focus on form and light.'
  },
  {
    value: 'chalk-pastel',
    label: '粉笔画风',
    preview: '粉',
    category: '绘本 / 艺术表达',
    keywords: ['粉笔', '粉彩', '黑板'],
    promptZh: '粉笔画风格，柔软粉质笔触，颗粒纹理，色彩温柔，带有手作黑板或粉彩纸质感。',
    promptEn: 'Chalk pastel style with soft powdery strokes, grain texture, gentle colors, and handmade chalkboard or pastel-paper feel.'
  },
  {
    value: 'collage-animation',
    label: '拼贴动画风',
    preview: '拼',
    category: '绘本 / 艺术表达',
    keywords: ['拼贴', '动画', '纸张'],
    promptZh: '拼贴动画风格，不同纸张、照片和纹理层叠组合，画面具有手工剪贴和实验动画气质。',
    promptEn: 'Collage animation style with layered paper, photo and texture elements, handmade cutout feel, and experimental animation character.'
  },
  {
    value: 'low-poly',
    label: '低多边形风',
    preview: '低',
    category: '绘本 / 艺术表达',
    keywords: ['低多边形', 'low poly', '几何'],
    promptZh: '低多边形美术风格，几何切面，简化造型，色块清晰，画面现代且具有轻量3D感。',
    promptEn: 'Low-poly art style with geometric facets, simplified shapes, clean color planes, and lightweight modern 3D feel.'
  },
  {
    value: 'pixel-animation',
    label: '像素动画风',
    preview: '像',
    category: '绘本 / 艺术表达',
    keywords: ['像素', 'pixel', '复古游戏'],
    promptZh: '像素动画风格，清晰像素块，复古游戏配色，动作具有逐帧动画感，画面简洁有趣。',
    promptEn: 'Pixel animation style with clear pixel blocks, retro game palette, frame-by-frame motion feel, and playful simplicity.'
  },
  {
    value: 'origami-animation',
    label: '折纸动画风',
    preview: '纸',
    category: '绘本 / 艺术表达',
    keywords: ['折纸', '纸艺', '动画'],
    promptZh: '折纸动画风格，纸张折痕和层次清晰，造型由折面构成，灯光突出纸艺材质。',
    promptEn: 'Origami animation style with visible paper folds and layers, folded-plane shapes, and lighting that emphasizes paper craft.'
  }
]

export type ArtStyleValue = (typeof ART_STYLES)[number]['value']

export function isArtStyleValue(value: unknown): value is ArtStyleValue {
  return typeof value === 'string' && ART_STYLES.some((style) => style.value === value)
}

/**
 * 🔥 实时从 ART_STYLES 常量获取风格 prompt
 * 这是获取风格 prompt 的唯一正确方式，确保始终使用最新的常量定义
 * 
 * @param artStyle - 风格标识符，如 'realistic', 'american-comic' 等
 * @returns 对应的风格 prompt，如果找不到则返回空字符串
 */
export function getArtStylePrompt(
  artStyle: string | null | undefined,
  locale: 'zh' | 'en',
): string {
  if (!artStyle) return ''
  const style = ART_STYLES.find(s => s.value === artStyle)
  if (!style) return ''
  return locale === 'en' ? style.promptEn : style.promptZh
}

// 角色形象生成的系统后缀（始终添加到提示词末尾，不显示给用户）- 左侧面部特写+右侧三视图
export const CHARACTER_PROMPT_SUFFIX = '角色设定图，画面分为左右两个区域：【左侧区域】占约1/3宽度，是角色的正面特写（如果是人类则展示完整正脸，如果是动物/生物则展示最具辨识度的正面形态）；【右侧区域】占约2/3宽度，是角色三视图横向排列（从左到右依次为：正面全身、侧面全身、背面全身），三视图高度一致。纯白色背景，无其他元素。'

// 道具图片生成的系统后缀（固定白底三视图资产图）
export const PROP_PROMPT_SUFFIX = '道具设定图，画面分为左右两个区域：【左侧区域】占约1/3宽度，是道具主体的主视图特写；【右侧区域】占约2/3宽度，是同一道具的三视图横向排列（从左到右依次为：正面、侧面、背面），三视图高度一致。纯白色背景，主体居中完整展示，无人物、无手部、无桌面陈设、无环境背景、无其他元素。'

// 场景图片生成的系统后缀（已禁用四视图，直接生成单张场景图）
export const LOCATION_PROMPT_SUFFIX = ''

// 角色资产图生成比例（当前角色设定图实际使用 3:2）
export const CHARACTER_ASSET_IMAGE_RATIO = '3:2'
// 历史保留：旧注释中曾写 16:9，但当前资产图生成统一以 CHARACTER_ASSET_IMAGE_RATIO 为准
export const CHARACTER_IMAGE_RATIO = CHARACTER_ASSET_IMAGE_RATIO
// 角色图片尺寸（用于Seedream API）
export const CHARACTER_IMAGE_SIZE = '3840x2160'  // 16:9 横版
// 角色图片尺寸（用于Banana API）
export const CHARACTER_IMAGE_BANANA_RATIO = CHARACTER_ASSET_IMAGE_RATIO

// 道具图片生成比例（与角色资产图保持一致）
export const PROP_IMAGE_RATIO = CHARACTER_ASSET_IMAGE_RATIO

// 场景图片生成比例（1:1 正方形单张场景）
export const LOCATION_IMAGE_RATIO = '1:1'
// 场景图片尺寸（用于Seedream API）- 4K
export const LOCATION_IMAGE_SIZE = '4096x4096'  // 1:1 正方形 4K
// 场景图片尺寸（用于Banana API）
export const LOCATION_IMAGE_BANANA_RATIO = '1:1'

// 从提示词中移除角色系统后缀（用于显示给用户）
export function removeCharacterPromptSuffix(prompt: string): string {
  if (!prompt) return ''
  return prompt.replace(CHARACTER_PROMPT_SUFFIX, '').trim()
}

// 添加角色系统后缀到提示词（用于生成图片）
export function addCharacterPromptSuffix(prompt: string): string {
  if (!prompt) return CHARACTER_PROMPT_SUFFIX
  const cleanPrompt = removeCharacterPromptSuffix(prompt)
  return `${cleanPrompt}${cleanPrompt ? '，' : ''}${CHARACTER_PROMPT_SUFFIX}`
}

export function removePropPromptSuffix(prompt: string): string {
  if (!prompt) return ''
  return prompt.replace(PROP_PROMPT_SUFFIX, '').replace(/，$/, '').trim()
}

export function addPropPromptSuffix(prompt: string): string {
  if (!prompt) return PROP_PROMPT_SUFFIX
  const cleanPrompt = removePropPromptSuffix(prompt)
  return `${cleanPrompt}${cleanPrompt ? '，' : ''}${PROP_PROMPT_SUFFIX}`
}

// 从提示词中移除场景系统后缀（用于显示给用户）
export function removeLocationPromptSuffix(prompt: string): string {
  if (!prompt) return ''
  return prompt.replace(LOCATION_PROMPT_SUFFIX, '').replace(/，$/, '').trim()
}

// 添加场景系统后缀到提示词（用于生成图片）
export function addLocationPromptSuffix(prompt: string): string {
  // 后缀为空时直接返回原提示词
  if (!LOCATION_PROMPT_SUFFIX) return prompt || ''
  if (!prompt) return LOCATION_PROMPT_SUFFIX
  const cleanPrompt = removeLocationPromptSuffix(prompt)
  return `${cleanPrompt}${cleanPrompt ? '，' : ''}${LOCATION_PROMPT_SUFFIX}`
}

/**
 * 构建角色介绍字符串（用于发送给 AI，帮助理解"我"和称呼对应的角色）
 * @param characters - 角色列表，需要包含 name 和 introduction 字段
 * @returns 格式化的角色介绍字符串
 */
export function buildCharactersIntroduction(characters: Array<{ name: string; introduction?: string | null }>): string {
  if (!characters || characters.length === 0) return '暂无角色介绍'

  const introductions = characters
    .filter(c => c.introduction && c.introduction.trim())
    .map(c => `- ${c.name}：${c.introduction}`)

  if (introductions.length === 0) return '暂无角色介绍'

  return introductions.join('\n')
}
