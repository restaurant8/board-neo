/**
 * 本地打包 Monaco（不依赖 CDN），适配 standalone 离线部署。
 * 通过 Vite 的 `?worker` 把 Monaco 的 worker 一起打进产物，并用 loader.config
 * 把 @monaco-editor/react 指向本地 monaco 实例（默认它会从 jsDelivr 远程加载）。
 * 该模块以副作用方式导入一次即可。
 */
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'

declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker(workerId: string, label: string): Worker
    }
  }
}

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'json') return new jsonWorker()
    return new editorWorker()
  },
}

loader.config({ monaco })

export {}
