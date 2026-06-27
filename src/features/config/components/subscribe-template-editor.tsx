import Editor from '@monaco-editor/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import '@/lib/monaco-setup'

/** 各客户端订阅模板（对齐原版：页签 + Monaco 代码编辑器，带行号/语法高亮）。 */
const CLIENTS: Array<{
  key: string
  tab: string
  title: string
  desc: string
  lang: string
}> = [
  {
    key: 'subscribe_template_singbox',
    tab: 'Sing-box',
    title: 'Sing-box 订阅模板',
    desc: '配置 Sing-box 的订阅模板格式',
    lang: 'json',
  },
  {
    key: 'subscribe_template_clash',
    tab: 'Clash',
    title: 'Clash 订阅模板',
    desc: '配置 Clash 的订阅模板格式',
    lang: 'yaml',
  },
  {
    key: 'subscribe_template_clashmeta',
    tab: 'Clash Meta',
    title: 'Clash Meta 订阅模板',
    desc: '配置 Clash Meta 的订阅模板格式',
    lang: 'yaml',
  },
  {
    key: 'subscribe_template_stash',
    tab: 'Stash',
    title: 'Stash 订阅模板',
    desc: '配置 Stash 的订阅模板格式',
    lang: 'yaml',
  },
  {
    key: 'subscribe_template_surge',
    tab: 'Surge',
    title: 'Surge 配置模板',
    desc: '配置 Surge 订阅模板，支持 Surge 配置文件格式',
    lang: 'ini',
  },
  {
    key: 'subscribe_template_surfboard',
    tab: 'Surfboard',
    title: 'Surfboard 配置模版',
    desc: '配置 Surfboard 订阅模版',
    lang: 'ini',
  },
]

type Props = {
  get: (key: string) => string
  set: (key: string, value: string) => void
}

export function SubscribeTemplateEditor({ get, set }: Props) {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  return (
    <Tabs defaultValue={CLIENTS[0].key} className='space-y-4'>
      <TabsList>
        {CLIENTS.map((c) => (
          <TabsTrigger key={c.key} value={c.key}>
            {c.tab}
          </TabsTrigger>
        ))}
      </TabsList>
      {CLIENTS.map((c) => (
        <TabsContent key={c.key} value={c.key} className='space-y-2'>
          <div>
            <h3 className='text-lg font-medium'>{c.title}</h3>
            <p className='text-muted-foreground text-sm'>{c.desc}</p>
          </div>
          <div className='overflow-hidden rounded-md border'>
            <Editor
              height='460px'
              language={c.lang}
              theme={isDark ? 'vs-dark' : 'vs'}
              value={get(c.key) ?? ''}
              onChange={(val) => set(c.key, val ?? '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                tabSize: 2,
                automaticLayout: true,
                wordWrap: 'off',
                renderLineHighlight: 'all',
                fixedOverflowWidgets: true,
              }}
            />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}
