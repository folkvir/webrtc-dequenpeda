<template>
  <layout :global=global>
    <b-row>
        <b-col cols="3" offset="1" class="leftPanel">Queries</b-col>
        <b-col cols="7"  class="rightPanel">
          Informations
        </b-col>
    </b-row>
  </layout>
</template>

<script>
import Layout from './layout.vue'

export default {
  name: 'demo',
  props: ['global'],
  data: function () { return { global: this.$props } },
  components: {
    Layout
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