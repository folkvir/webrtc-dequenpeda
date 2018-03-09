<template>
  <div id="layout">
    <navbar :global=global></navbar>
    <b-container fluid class="bv-example-row">
      <slot></slot>
    </b-container>
  </div>
</template>

<script>
import navbar from './navbar.vue'

export default {
  props: ['global'],
  components: {
    navbar
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