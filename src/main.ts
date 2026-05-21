import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './i18n'
import './style.css'
import './components/Scrollbar/src/style.css'

createApp(App).use(i18n).mount('#app')
