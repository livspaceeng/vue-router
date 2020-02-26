export default {
  name: 'RouterMfe',
  props: {
    name: {
      type: String,
      default: 'default'
    }
  },
  render (h) {
    // used by devtools to display a router-view badge
    // data.routerView = true
    // const h = parent.$createElement
    return h('div', { ref: 'host' })
  },

  mounted () {
    const route = this.$parent.$route
    debugger
    const depth = 0
    const matched = route.matched[depth]
    if (matched && matched.mfes) {
      const name = Object.keys(matched.mfes)[0]
      const mfe = matched && matched.mfes[name]
      // const subroutes = this.mfe.router;
      // this.router.addRoutes(this.currentroute, subroutes);
      mfe.boot(this.$refs.host).then(() => {
        this.$emit('bootfinished')
      })
    }
  }
}
