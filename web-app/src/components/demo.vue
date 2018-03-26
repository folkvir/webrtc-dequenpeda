<template>
  <layout :global=global>
    <b-row>
        <b-col cols='3' offset="1" class="leftPanel">Queries</b-col>
        <b-col cols="7"  class="rightPanel">
          Informations
          <div><button v-on:click="connection"> Connection </button></div>

          <div><survey :survey="survey"></survey></div>
        </b-col>
    </b-row>

  </layout>
</template>

<script>
import Layout from './layout.vue'
import { othersurvey, defaultsurvey } from './default-survey'
import * as SurveyVue from 'survey-vue'

var Survey = SurveyVue.Survey
Survey.cssType = "bootstrap";

export default {
  name: 'demo',
  props: ['global'],
  components: {
    Layout,
    Survey
  },
  data: function () {
    let model = new SurveyVue.Model(defaultsurvey)
    model.onComplete.add((result) => {
      console.log(JSON.stringify(result.data))
    })
    return {
        survey: model
    }
  },
  methods: {
    onComplete: function(json) {
      console.log('Complete: ', json)
    },
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
