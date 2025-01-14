const { clipboard } = require('electron')
const fs = require('fs')
const path = require('path')

// 确保在 DOM 加载完成后初始化 services
window.addEventListener('DOMContentLoaded', () => {
  window.services = {
    // 获取设置
    getSettings: () => {
      return utools.dbStorage.getItem('qwen_ocr_settings') || {
        tokens: [],
        prompt: ''
      }
    },

    // 保存设置
    saveSettings: (settings) => {
      // 确保 tokens 是数组格式
      if (typeof settings.tokens === 'string') {
        settings.tokens = settings.tokens.split(',').map(t => t.trim()).filter(t => t);
      }
      utools.dbStorage.setItem('qwen_ocr_settings', settings)
    },

    // 获取随机 token
    getRandomToken: () => {
      const settings = utools.dbStorage.getItem('qwen_ocr_settings') || { tokens: [] }
      const tokens = settings.tokens
      if (!tokens || tokens.length === 0) return null
      return tokens[Math.floor(Math.random() * tokens.length)]
    },

    // 复制文本到剪贴板
    copyToClipboard: (text) => {
      clipboard.writeText(text)
    },

    // 保存图片到临时文件
    saveTempImage: (base64Data) => {
      const tempDir = utools.getPath('temp')
      const imagePath = path.join(tempDir, `qwen_ocr_${Date.now()}.png`)
      const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '')
      fs.writeFileSync(imagePath, Buffer.from(base64Image, 'base64'))
      return imagePath
    },

    // 从文件路径读取图片为 base64
    readImageAsBase64: (filePath) => {
      const data = fs.readFileSync(filePath)
      return `data:image/png;base64,${data.toString('base64')}`
    }
  }

  // 监听插件进入事件
  utools.onPluginEnter(({ code, type, payload }) => {
    // 如果是图片类型的输入
    if (type === 'img') {
      // 获取图片路径
      const imagePath = payload[0];
      // 转换为 base64
      const imageData = window.services.readImageAsBase64(imagePath);
      // 触发图片处理
      if (window.processPluginImage) {
        window.processPluginImage(imageData);
      }
    }
  })
}) 