<template>
  <layout :global=global>
    <b-row>
        <b-col cols="3" offset="1" class="leftPanel">Queries</b-col>
        <b-col cols="7"  class="rightPanel">
          Informations
          <button v-on:click="connection"> Connection </button>
        </b-col>
    </b-row>
  </layout>
</template>

<script>
import Layout from './layout.vue'

export default {
  name: 'demo',
  props: ['global'],
  components: {
    Layout
  },
  methods: {
    connection: function () {
      this.$bus.foglet.emit('connected')
      this.$bus.$on('connected', () =>{
        console.log('[*] The user is on the network.')
      })
      this.$bus.foglet.connection().then(() => {
        this.$bus.$emit('connected')
      })
    }
  }
}
</script>

<style{{#sass}} lang="scss"{{/sass}}>

  .leftPanel {
    background-color: green;
  }

  .rightPanel {
    background-color: red;
  }
</style>