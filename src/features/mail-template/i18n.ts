/**
 * 邮件模板面板的中文文案（对齐原版 locales/zh-CN settings.email_template）。
 * board-neo 仅简体中文，因此以静态映射替代 i18next。
 */
export const mailTemplateText: Record<string, string> = {
  'common.loading': '加载中...',
  'email_template.title': '邮件模板',
  'email_template.description': '自定义系统发送的各类邮件内容模板',
  'email_template.customized': '已自定义',
  'email_template.subject': '邮件主题',
  'email_template.subject_placeholder': '输入邮件主题，支持 {{name}} 等占位符',
  'email_template.content': '模板内容 (HTML)',
  'email_template.preview': '实时预览',
  'email_template.override_hint':
    '修改并保存后将覆盖系统默认模板。点击「恢复默认」可随时还原为当前主题的默认模板。',
  'email_template.placeholders': '可用占位符',
  'email_template.var_name': '变量',
  'email_template.var_desc': '说明',
  'email_template.var_sample': '示例值',
  'email_template.required': '必填',
  'email_template.insert': '插入',
  'email_template.placeholder_hint': '* 标记为必须包含的占位符，点击可插入到内容末尾',
  'email_template.click_to_insert': '点击插入',
  'email_template.save': '保存',
  'email_template.save_success': '模板保存成功',
  'email_template.save_before_test': '请先保存修改后再发送测试',
  'email_template.send_test': '发送测试',
  'email_template.test_dialog_title': '发送测试邮件',
  'email_template.test_dialog_description':
    '输入收件邮箱，留空将发送到当前管理员邮箱',
  'email_template.test_email_placeholder': '收件邮箱（留空使用当前账号）',
  'email_template.sending': '发送中...',
  'email_template.test_success': '测试邮件已发送',
  'email_template.reset': '恢复默认',
  'email_template.reset_title': '恢复默认模板',
  'email_template.reset_description':
    '确定要恢复此模板为默认内容吗？自定义的内容将被删除。',
  'email_template.reset_confirm': '确定恢复',
  'email_template.reset_success': '已恢复默认模板',
  'email_template.unsaved': '有未保存的修改',
  'email_template.discard_title': '未保存的修改',
  'email_template.discard_description':
    '当前模板有未保存的修改，切换标签页将丢失这些修改。',
  'email_template.discard_confirm': '丢弃修改',
  'email_template.cancel': '取消',
}
