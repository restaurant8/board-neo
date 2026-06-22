import {
  LayoutDashboard,
  Settings,
  Package,
  Server,
  Network,
  Route as RouteIcon,
  Cpu,
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
      title: '概览',
      items: [
        { title: '仪表盘', url: '/', icon: LayoutDashboard },
      ],
    },
    {
      title: '业务管理',
      items: [
        { title: '订单管理', url: '/order', icon: ShoppingCart },
        { title: '用户管理', url: '/user', icon: Users },
        { title: '套餐管理', url: '/plan', icon: Package },
        { title: '优惠券', url: '/coupon', icon: Ticket },
        { title: '礼品卡', url: '/gift-card', icon: Gift },
        { title: '支付配置', url: '/payment', icon: CreditCard },
      ],
    },
    {
      title: '节点管理',
      items: [
        { title: '节点管理', url: '/server/manage', icon: Server },
        { title: '权限组', url: '/server/group', icon: Network },
        { title: '路由规则', url: '/server/route', icon: RouteIcon },
        { title: '机器管理', url: '/server/machine', icon: Cpu },
        { title: 'DNS 同步', url: '/server/dns', icon: Globe },
        { title: '流量重置', url: '/traffic-reset', icon: RefreshCw },
      ],
    },
    {
      title: '运营',
      items: [
        { title: '公告管理', url: '/notice', icon: Bell },
        { title: '工单管理', url: '/ticket', icon: LifeBuoy },
        { title: '知识库', url: '/knowledge', icon: BookOpen },
      ],
    },
    {
      title: '系统',
      items: [
        { title: '系统配置', url: '/config', icon: Settings },
        { title: '邮件模板', url: '/mail-template', icon: Mail },
        { title: '主题管理', url: '/theme', icon: Palette },
        { title: '插件管理', url: '/plugin', icon: Puzzle },
        { title: '系统状态', url: '/system', icon: Activity },
      ],
    },
  ],
}
