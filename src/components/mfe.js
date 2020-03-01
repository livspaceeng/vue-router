export default {
  name: 'RouterMfe',
  props: {
    name: {
      type: String,
      default: 'default'
    },
    useShadowDom: {
      type: Boolean,
      default: false
    },
    shadowStyles: {
      type: String
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
    const depth = 0
    const matched = route.matched[depth]
    if (matched && matched.mfes) {
      const name = Object.keys(matched.mfes)[0]
      const mfe = matched && matched.mfes[name]
      // const subroutes = this.mfe.router;
      // this.router.addRoutes(this.currentroute, subroutes);

      if (this.useShadowDom) {
        const host = this.$refs.host
        const shadowroot = host.attachShadow({ mode: 'open' })

        const shodowhost = document.createElement('div')

        shadowroot.appendChild(shodowhost)
        mfe.boot(shodowhost, { mountpoint: shadowroot }).then(() => {
          this.$emit('bootfinished')
        })
      } else {
        const host = this.$refs.host
        mfe.boot(host, { mountpoint: this.$refs.host }).then(() => {
          this.$emit('bootfinished')
        })
      }
    }
  }
}
