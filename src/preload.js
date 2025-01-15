const { clipboard } = require('electron')
const fs = require('fs')
const fsPromises = require('fs').promises
const path = require('path')

// 确保在 DOM 加载完成后初始化 services
window.addEventListener('DOMContentLoaded', () => {
  // 清理临时文件
  const cleanupTempFiles = async (dir) => {
    try {
      const files = await fsPromises.readdir(dir)
      const now = Date.now()
      for (const file of files) {
        if (file.startsWith('qwen_ocr_')) {
          const filePath = path.join(dir, file)
          const stats = await fsPromises.stat(filePath)
          // 删除超过1小时的临时文件
          if (now - stats.mtimeMs > 3600000) {
            await fsPromises.unlink(filePath)
          }
        }
      }
    } catch (error) {
      console.error('清理临时文件失败:', error)
    }
  }

  window.services = {
    // 获取设置
    getSettings: () => {
      try {
        return utools.dbStorage.getItem('qwen_ocr_settings') || {
          tokens: [],
          prompt: '',
          deeplxUrl: '',
          openaiUrl: '',
          openaiToken: '',
          openaiModel: 'gpt-4-vision-preview',
          translationService: 'deeplx',
          ocrService: 'qwen',
          targetLang: 'ZH',
          translatePrompt: ''
        }
      } catch (error) {
        console.error('获取设置失败:', error)
        return { 
          tokens: [], 
          prompt: '',
          deeplxUrl: '',
          openaiUrl: '',
          openaiToken: '',
          openaiModel: 'gpt-4-vision-preview',
          translationService: 'deeplx',
          ocrService: 'qwen',
          targetLang: 'ZH',
          translatePrompt: ''
        }
      }
    },

    // 保存设置
    saveSettings: (settings) => {
      try {
        if (!settings || typeof settings !== 'object') {
          throw new Error('无效的设置对象')
        }
        // 确保 tokens 是数组格式
        if (typeof settings.tokens === 'string') {
          settings.tokens = settings.tokens.split(',').map(t => t.trim()).filter(t => t)
        }
        if (!Array.isArray(settings.tokens)) {
          settings.tokens = []
        }
        // 确保其他字段存在
        settings = {
          tokens: settings.tokens || [],
          prompt: settings.prompt || '',
          deeplxUrl: settings.deeplxUrl || '',
          openaiUrl: settings.openaiUrl || '',
          openaiToken: settings.openaiToken || '',
          openaiModel: settings.openaiModel || 'gpt-4-vision-preview',
          translationService: settings.translationService || 'deeplx',
          ocrService: settings.ocrService || 'qwen',
          targetLang: settings.targetLang || 'ZH',
          translatePrompt: settings.translatePrompt || ''
        }
        utools.dbStorage.setItem('qwen_ocr_settings', settings)
      } catch (error) {
        console.error('保存设置失败:', error)
        throw error
      }
    },

    // 获取随机 token
    getRandomToken: () => {
      try {
        const settings = utools.dbStorage.getItem('qwen_ocr_settings') || { tokens: [] }
        const tokens = settings.tokens
        if (!tokens || tokens.length === 0) return null
        return tokens[Math.floor(Math.random() * tokens.length)]
      } catch (error) {
        console.error('获取Token失败:', error)
        return null
      }
    },

    // 复制文本到剪贴板
    copyToClipboard: (text) => {
      try {
        if (typeof text !== 'string') {
          throw new Error('复制内容必须是字符串')
        }
        clipboard.writeText(text)
      } catch (error) {
        console.error('复制到剪贴板失败:', error)
        throw error
      }
    },

    // 保存图片到临时文件
    saveTempImage: (base64Data) => {
      try {
        if (!base64Data || typeof base64Data !== 'string') {
          throw new Error('无效的图片数据')
        }
        const tempDir = utools.getPath('temp')
        const imagePath = path.join(tempDir, `qwen_ocr_${Date.now()}.png`)
        const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '')
        fs.writeFileSync(imagePath, Buffer.from(base64Image, 'base64'))
        return imagePath
      } catch (error) {
        console.error('保存临时图片失败:', error)
        throw error
      }
    },

    // 从文件路径读取图片为 base64
    readImageAsBase64: (filePath) => {
      try {
        if (!filePath || typeof filePath !== 'string') {
          throw new Error('无效的文件路径')
        }
        const data = fs.readFileSync(filePath)
        return `data:image/png;base64,${data.toString('base64')}`
      } catch (error) {
        console.error('读取图片失败:', error)
        throw error
      }
    },

    // OpenAI 翻译功能
    callOpenAIAPI: async (text, targetLang) => {
      const settings = utools.dbStorage.getItem('qwen_ocr_settings') || {};
      const apiUrl = settings.openaiUrl + '/v1/chat/completions' || 'https://api.openai.com/v1/chat/completions';
      const apiToken = settings.openaiToken;
      const model = settings.openaiModel || 'gpt-3.5-turbo';

      if (!apiToken) {
        throw new Error('请先配置 OpenAI API Token');
      }

      let prompt = settings.translatePrompt || '请将以下文本翻译成{{lang}}，保持原文的格式和数学公式：\n\n{{text}}';
      prompt = prompt.replace('{{text}}', text).replace('{{lang}}', getLangName(targetLang));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的翻译助手。你的任务是准确翻译用户提供的文本，保持原文的格式，特别是数学公式和代码块的格式。只返回翻译后的文本，不要添加任何解释或其他内容。'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API 请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    }
  }

  // 获取语言名称
  function getLangName(langCode) {
    const langMap = {
      'ZH': '中文',
      'EN': '英文',
      'JA': '日语',
      'KO': '韩语',
      'FR': '法语',
      'DE': '德语',
      'ES': '西班牙语',
      'RU': '俄语'
    };
    return langMap[langCode] || langCode;
  }

  // 定期清理临时文件
  const tempDir = utools.getPath('temp')
  cleanupTempFiles(tempDir)
  setInterval(() => cleanupTempFiles(tempDir), 3600000) // 每小时清理一次

  // 监听插件进入事件
  utools.onPluginEnter(({ code, type, payload }) => {
    try {
      if(payload === '截图文字识别'){
        // 调用系统截图
        utools.screenCapture((imageBase64) => {
          if (imageBase64 && window.processPluginImage) {
            window.processPluginImage(imageBase64)
          }
        })
      }
      // 如果是图片类型的输入
      if (type === 'img') {
        // payload 直接就是 base64 字符串
        if (window.processPluginImage) {
          window.processPluginImage(payload)
        }
      } else if (type === 'files' && Array.isArray(payload) && payload.length > 0) {
        // 处理文件类型输入
        const fileObj = payload[0]
        if (fileObj.isFile && /\.(jpg|jpeg|png|gif|bmp)$/i.test(fileObj.path)) {
          const imageData = window.services.readImageAsBase64(fileObj.path)
          if (window.processPluginImage) {
            window.processPluginImage(imageData)
          }
        }
      }
    } catch (error) {
      console.error('插件处理失败:', error)
    }
  })
}) 