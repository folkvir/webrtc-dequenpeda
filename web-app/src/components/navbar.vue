<template>
  <b-navbar toggleable="md" type="light" variant="light">

    <b-navbar-toggle target="nav_collapse"></b-navbar-toggle>

    <b-navbar-brand href="#">{{title}}</b-navbar-brand>

    <b-collapse is-nav id="nav_collapse">

      <b-navbar-nav>
        <b-nav-item to="/" exact>Home</b-nav-item>
        <b-nav-item to="/demo">Demo</b-nav-item>
      </b-navbar-nav>

      <!-- Right aligned nav items -->
      <b-navbar-nav class="ml-auto">

        <b-nav-form>
          <b-form-input size="sm" class="mr-sm-2" type="text" variant="outline-success" placeholder="Search"/>
          <b-button size="sm" class="my-2 my-sm-0" type="submit" variant="outline-success" >Search</b-button>
        </b-nav-form>
        <b-nav-item :href=github>
          <img src="../assets/github32.png" fluid alt="Github Logo" /> 
        </b-nav-item>

      </b-navbar-nav>

    </b-collapse>
  </b-navbar>  
</template>

<script>

export default {
  props: ['global'],
  data: function () { return {github: this.global.github, title: this.global.title}}
}
</script>


