<template>
  <layout :global=global>
    <b-row>
        <b-col cols="10" offset="1" class="rightPanel">

          Please complete this form.
          <my-survey/>
        </b-col>
    </b-row>

  </layout>
</template>

<script>
import Layout from './layout.vue'
import MySurvey from './survey.vue'

export default {
  name: 'demo',
  props: ['global'],
  components: {
    Layout,
    MySurvey
  },
  created: function () {
    this.connection()
  },
  methods: {
    onComplete: function(json) {
      console.log('Complete: ', json)
    },
    connection: function () {
      this.$bus.foglet.emit('connected')
      this.$bus.$once('connected', () =>{
        console.log('[*] The user is on the network.')
      })
      this.$bus.foglet.connection().then(() => {
        this.$bus.$emit('connected')
      })
    }
  }
}
</script>
