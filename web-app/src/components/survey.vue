<template>
  <layout :global=global>
    <div id="surveyContainer"> <survey-window :survey="survey"></survey-window></div>
  </layout>
</template>

<script>
import Layout from './layout.vue'
import Survey from 'survey-vue'
console.log(Survey)
Survey.Survey.cssType = "bootstrap"
import DefaultSurvey from './default-survey'

const survey = new Survey.Model(DefaultSurvey);
export default {
  name: 'surveyContainer',
  props: ['global'],
  components: {
    Layout
  },
  data: {
    survey: survey
  },
  methods: {}
}
</script>
