import Vue from 'vue'
import VueRouter from 'vue-router'
Vue.use(VueRouter)
// use bootstrap vue now
import BootstrapVue from 'bootstrap-vue'
Vue.use(BootstrapVue);
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'

import { Navbar } from 'bootstrap-vue/es/components';
Vue.use(Navbar);

//just activate the foglet Bus
require('./foglet-bus')

import globalValues from './global-values'

import Home  from './components/home.vue'
import Demo  from './components/demo.vue'

const routes = [
  { path: '/', component: Home , props: {global: globalValues}},
  { path: '/demo', component: Demo , props: {global: globalValues}},
  { path: '*', redirect: '/', props: {global: globalValues}}
] 

const router = new VueRouter({
  routes
})

const app = new Vue({
  router
}).$mount('#app')