import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import MyLayout from './components/MyLayout.vue'

export default {
    extends: DefaultTheme,
    Layout: MyLayout
}