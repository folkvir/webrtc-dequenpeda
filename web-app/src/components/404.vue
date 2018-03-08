<template>
  <div id='notfound'>
    <navbar></navbar>
  </div>
</template>

<script>
  import navbar from './navbar.vue'
  import globalValues from '../global-values.js'
  
  export default {
    el: '#notfound',
    data: globalValues,
    components: {
      navbar
    }
  }
</script>