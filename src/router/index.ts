import { createRouter, createWebHistory } from 'vue-router'
import SummaryView from '@/views/SummaryView.vue'
import EditView from '@/views/EditView.vue'
import { authService } from '@/services/auth.service'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/summary'
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/components/LoginForm.vue'),
      meta: {
        title: 'ログイン',
        requiresAuth: false
      }
    },
    {
      path: '/summary',
      name: 'summary',
      component: SummaryView,
      meta: {
        title: 'ポートフォリオ',
        requiresAuth: true
      }
    },
    {
      path: '/edit',
      name: 'edit', 
      component: EditView,
      meta: {
        title: '保有数量入力',
        requiresAuth: true
      }
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.meta.requiresAuth !== false
  const isAuthenticated = await authService.isAuthenticated()
  
  if (requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (to.name === 'login' && isAuthenticated) {
    next('/summary')
  } else {
    next()
  }
})

export default router