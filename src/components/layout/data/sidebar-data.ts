import {
  LayoutDashboard,
  Settings,
  Package,
  Server,
  Network,
  Route as RouteIcon,
  Cpu,
  Terminal,
  Globe,
  ShoppingCart,
  Users,
  Bell,
  LifeBuoy,
  Ticket,
  Gift,
  BookOpen,
  CreditCard,
  Activity,
  Palette,
  Puzzle,
  RefreshCw,
  BarChart3,
  Mail,
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

        // 大菜单 1：用户管理
        {
          title: '用户管理',
          icon: Users,
          items: [
            { title: '用户列表', url: '/user', icon: Users },
            { title: '工单管理', url: '/ticket', icon: LifeBuoy },
            { title: '知识库', url: '/knowledge', icon: BookOpen },
          ],
        },

        // 大菜单 2：财务管理
        {
          title: '财务管理',
          icon: CreditCard,
          items: [
            { title: '订单管理', url: '/order', icon: ShoppingCart },
            { title: '套餐管理', url: '/plan', icon: Package },
            { title: '优惠券', url: '/coupon', icon: Ticket },
            { title: '礼品卡', url: '/gift-card', icon: Gift },
            { title: '支付配置', url: '/payment', icon: CreditCard },
          ],
        },

        // 大菜单 3：节点管理
        {
          title: '节点管理',
          icon: Server,
          items: [
            { title: '节点管理', url: '/server/manage', icon: Server },
            { title: '权限组', url: '/server/group', icon: Network },
            { title: '路由规则', url: '/server/route', icon: RouteIcon },
            { title: '机器管理', url: '/server/machine', icon: Cpu },
            { title: '后端管理', url: '/server/backend', icon: Terminal },
            { title: 'DNS 同步', url: '/server/dns', icon: Globe },
            { title: '流量统计', url: '/traffic-stat', icon: BarChart3 },
            { title: '流量重置', url: '/traffic-reset', icon: RefreshCw },
          ],
        },

        // 大菜单 4：系统管理
        {
          title: '系统管理',
          icon: Settings,
          items: [
            { title: '系统配置', url: '/config', icon: Settings },
            { title: '公告管理', url: '/notice', icon: Bell },
            { title: '邮件模板', url: '/mail-template', icon: Mail },
            { title: '主题管理', url: '/theme', icon: Palette },
            { title: '插件管理', url: '/plugin', icon: Puzzle },
            { title: '系统状态', url: '/system', icon: Activity },
          ],
        },
      ],
    },
  ],
}
