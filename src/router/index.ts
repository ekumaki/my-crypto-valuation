import { createRouter, createWebHistory } from 'vue-router'
import SummaryView from '@/views/SummaryView.vue'
import EditView from '@/views/EditView.vue'
import ExchangeView from '@/views/ExchangeView.vue'
import { authService } from '@/services/auth.service'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/edit'
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
        title: '銘柄別',
        requiresAuth: true
      }
    },
    {
      path: '/edit',
      name: 'edit', 
      component: EditView,
      meta: {
        title: 'トークン一覧',
        requiresAuth: true
      }
    },
    {
      path: '/exchange',
      name: 'exchange',
      component: ExchangeView,
      meta: {
        title: '取引所別',
        requiresAuth: true
      }
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  
  const requiresAuth = to.meta.requiresAuth !== false
  let isAuthenticated = false
  
  try {
    isAuthenticated = await authService.isAuthenticated()
  } catch (error) {
    isAuthenticated = false
  }
  
  
  if (requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (to.name === 'login' && isAuthenticated) {
    next('/summary')
  } else {
    next()
  }
})

export default router
