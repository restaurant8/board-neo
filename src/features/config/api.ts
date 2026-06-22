import { get, post } from '@/lib/api-client'

/** Cloudflare DNS zone entry (server group). */
export type CloudflareDnsZone = {
  zone_id: string
  remark: string
}

/**
 * Full config object returned by GET /config/fetch, grouped by section.
 * Mirrors ConfigController::getConfigMappings(). All fields optional on the
 * client side because the backend may omit/extend keys across versions.
 */
export type ConfigData = {
  invite?: {
    invite_force?: boolean
    invite_commission?: number
    invite_gen_limit?: number
    invite_never_expire?: boolean
    commission_first_time_enable?: boolean
    commission_auto_check_enable?: boolean
    commission_withdraw_limit?: number | null
    commission_withdraw_method?: string[] | null
    withdraw_close_enable?: boolean
    commission_distribution_enable?: boolean
    commission_distribution_l1?: number | null
    commission_distribution_l2?: number | null
    commission_distribution_l3?: number | null
  }
  site?: {
    logo?: string | null
    force_https?: number
    stop_register?: number
    app_name?: string
    app_description?: string
    app_url?: string | null
    subscribe_url?: string | null
    try_out_plan_id?: number
    try_out_hour?: number
    tos_url?: string | null
    currency?: string
    currency_symbol?: string
    ticket_must_wait_reply?: boolean
  }
  subscribe?: {
    plan_change_enable?: boolean
    reset_traffic_method?: number
    surplus_enable?: boolean
    new_order_event_id?: number
    renew_order_event_id?: number
    change_order_event_id?: number
    show_info_to_server_enable?: boolean
    show_protocol_to_server_enable?: boolean
    default_remind_expire?: boolean
    default_remind_traffic?: boolean
    subscribe_path?: string
  }
  frontend?: {
    frontend_theme?: string
    frontend_theme_sidebar?: string
    frontend_theme_header?: string
    frontend_theme_color?: string
    frontend_background_url?: string | null
  }
  server?: {
    server_token?: string | null
    server_pull_interval?: number
    server_push_interval?: number
    traffic_stats_mode?: string
    traffic_stats_interval?: number
    device_limit_mode?: number
    server_ws_enable?: boolean
    server_ws_url?: string
    cloudflare_dns_api_token?: string
    cloudflare_dns_zone_id?: string
    cloudflare_dns_zones?: CloudflareDnsZone[]
    cloudflare_dns_proxied?: boolean
    cloudflare_dns_ttl?: number
  }
  email?: {
    email_host?: string | null
    email_port?: string | number | null
    email_username?: string | null
    email_password?: string | null
    email_encryption?: string | null
    email_from_address?: string | null
    remind_mail_enable?: boolean
  }
  telegram?: {
    telegram_bot_enable?: boolean
    telegram_bot_token?: string | null
    telegram_webhook_url?: string | null
    telegram_discuss_link?: string | null
  }
  app?: {
    windows_version?: string
    windows_download_url?: string
    macos_version?: string
    macos_download_url?: string
    android_version?: string
    android_download_url?: string
  }
  safe?: {
    email_verify?: boolean
    safe_mode_enable?: boolean
    secure_path?: string
    email_whitelist_enable?: boolean
    email_whitelist_suffix?: string[] | string | null
    email_gmail_limit_enable?: boolean
    captcha_enable?: boolean
    captcha_type?: string
    recaptcha_key?: string
    recaptcha_site_key?: string
    recaptcha_v3_secret_key?: string
    recaptcha_v3_site_key?: string
    recaptcha_v3_score_threshold?: number
    turnstile_secret_key?: string
    turnstile_site_key?: string
    register_limit_by_ip_enable?: boolean
    register_limit_count?: number
    register_limit_expire?: number
    password_limit_enable?: boolean
    password_limit_count?: number
    password_limit_expire?: number
    recaptcha_enable?: boolean
  }
  subscribe_template?: {
    subscribe_template_singbox?: string
    subscribe_template_clash?: string
    subscribe_template_clashmeta?: string
    subscribe_template_stash?: string
    subscribe_template_surge?: string
    subscribe_template_surfboard?: string
  }
}

/** Any subset of the flattened config keys, what /config/save accepts. */
export type ConfigSavePayload = Record<string, unknown>

/** GET /config/fetch — returns the full grouped config object. */
export function fetchConfig() {
  return get<ConfigData>('/config/fetch')
}

/** POST /config/save — persist any subset of flattened config keys. */
export function saveConfig(payload: ConfigSavePayload) {
  return post<boolean>('/config/save', payload)
}

/** GET /config/getEmailTemplate — helper dropdown: mail view file names. */
export function getEmailTemplate() {
  return get<string[]>('/config/getEmailTemplate')
}

/** GET /config/getThemeTemplate — helper dropdown: public theme dir names. */
export function getThemeTemplate() {
  return get<string[]>('/config/getThemeTemplate')
}

export type TelegramWebhookResult = {
  success: boolean
  webhook_url: string
  webhook_base_url: string | null
}

/** POST /config/setTelegramWebhook — register the Telegram bot webhook. */
export function setTelegramWebhook(telegram_bot_token: string) {
  return post<TelegramWebhookResult>('/config/setTelegramWebhook', {
    telegram_bot_token,
  })
}

/** POST /config/testSendMail — send a test email to the current admin. */
export function testSendMail() {
  return post<unknown>('/config/testSendMail')
}
