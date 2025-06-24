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
  console.log('[DEBUG] Router guard - navigating to:', to.path)
  
  const requiresAuth = to.meta.requiresAuth !== false
  const isAuthenticated = await authService.isAuthenticated()
  
  console.log('[DEBUG] Router guard - requiresAuth:', requiresAuth, 'isAuthenticated:', isAuthenticated)
  
  if (requiresAuth && !isAuthenticated) {
    console.log('[DEBUG] Router guard - redirecting to /login')
    next('/login')
  } else if (to.name === 'login' && isAuthenticated) {
    console.log('[DEBUG] Router guard - redirecting to /summary')
    next('/summary')
  } else {
    console.log('[DEBUG] Router guard - allowing navigation')
    next()
  }
})

export default router