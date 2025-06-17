import { createRouter, createWebHistory } from 'vue-router'
import SummaryView from '@/views/SummaryView.vue'
import EditView from '@/views/EditView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/summary'
    },
    {
      path: '/summary',
      name: 'summary',
      component: SummaryView,
      meta: {
        title: 'ポートフォリオ'
      }
    },
    {
      path: '/edit',
      name: 'edit', 
      component: EditView,
      meta: {
        title: '保有数量入力'
      }
    }
  ]
})

export default router