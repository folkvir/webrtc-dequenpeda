<template>
  <div id='mysurvey'>
    Or generate random informations and complete: <button v-on:click="random"> generate </button>
    <survey :survey="survey" />
    <div id='surveyResult'></div>
  </div>
</template>

<script>
import { personal } from './default-survey'
import * as SurveyVue from 'survey-vue'

let Survey = SurveyVue.Survey
Survey.cssType = "bootstrap";
SurveyVue.defaultBootstrapCss.navigationButton = "btn btn-green";

export default {
  name:'mysurvey',
  data: function () {
    let model = new SurveyVue.Model(personal)
    model.onComplete.add((result) => {
      document.getElementById('surveyResult').innerHTML = "result: " + JSON.stringify(result.data);
      console.log(JSON.stringify(result.data))
    })
    console.log(model)
    return {
      name: 'my funcking survey',
      survey: model
    }
  },
  created: function () {
    console.log('created')
  },
  methods: {
    random: function() {
      console.log('generate')
    }
  }
}
</script>

<style{{#sass}} lang="scss"{{/sass}}>
.btn-green {
  background-color: red;
  color: #fff;
  border-radius: 3px;
}
.btn-green:focus,
.btn-green:hover {
  background-color: #18a689;
  color: #fff;
}
.panel-footer {
  padding: 0 15px;
  border: none;
  text-align: right;
  background-color: red;
}
</style>
