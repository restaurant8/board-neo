import {
  LayoutDashboard,
  Activity,
  Settings,
  Puzzle,
  Palette,
  Bell,
  CreditCard,
  BookOpen,
  Mail,
  Server,
  Network,
  Route as RouteIcon,
  Cpu,
  Terminal,
  Globe,
  RefreshCw,
  Package,
  ShoppingCart,
  Ticket,
  Gift,
  Users,
  LifeBuoy,
  Command,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Admin',
    email: 'admin@xboard',
    avatar: '/images/favicon.png',
  },
  teams: [
    {
      name: 'Xboard',
      logo: Command,
      plan: 'Admin',
    },
  ],
  navGroups: [
    {
      title: '',
      items: [
        // 独立入口
        { title: '仪表盘', url: '/', icon: LayoutDashboard },

        // 统计分析
        {
          title: '统计分析',
          icon: Activity,
          items: [{ title: '流量统计', url: '/traffic-stat', icon: Activity }],
        },

        // 系统管理
        {
          title: '系统管理',
          icon: Settings,
          items: [
            { title: '系统配置', url: '/config', icon: Settings },
            { title: '插件管理', url: '/plugin', icon: Puzzle },
            { title: '主题配置', url: '/theme', icon: Palette },
            { title: '公告管理', url: '/notice', icon: Bell },
            { title: '支付配置', url: '/payment', icon: CreditCard },
            { title: '知识库管理', url: '/knowledge', icon: BookOpen },
            { title: '邮件模板', url: '/mail-template', icon: Mail },
            { title: '系统状态', url: '/system', icon: Activity },
          ],
        },

        // 节点管理
        {
          title: '节点管理',
          icon: Server,
          items: [
            { title: '服务器管理', url: '/server/machine', icon: Cpu },
            { title: '节点管理', url: '/server/manage', icon: Server },
            { title: '权限组管理', url: '/server/group', icon: Network },
            { title: '路由管理', url: '/server/route', icon: RouteIcon },
            { title: '后端管理', url: '/server/backend', icon: Terminal },
            { title: 'DNS 同步', url: '/server/dns', icon: Globe },
            { title: '流量重置', url: '/traffic-reset', icon: RefreshCw },
          ],
        },

        // 订阅管理
        {
          title: '订阅管理',
          icon: Package,
          items: [
            { title: '套餐管理', url: '/plan', icon: Package },
            { title: '订单管理', url: '/order', icon: ShoppingCart },
            { title: '优惠券管理', url: '/coupon', icon: Ticket },
            { title: '礼品卡管理', url: '/gift-card', icon: Gift },
          ],
        },

        // 用户管理
        {
          title: '用户管理',
          icon: Users,
          items: [
            { title: '用户管理', url: '/user', icon: Users },
            { title: '工单管理', url: '/ticket', icon: LifeBuoy },
          ],
        },
      ],
    },
  ],
}
