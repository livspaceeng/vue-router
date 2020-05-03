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
    this.$vnode.data.routerView = true
    const route = this.$parent.$route
    const depth = 0
    const matched = route.matched[depth]
    if (matched && matched.mfes) {
      const name = Object.keys(matched.mfes)[0]
      const mfe = matched && matched.mfes[name]
      if (name && mfe) {
        const subroutes = mfe.routes
        this.$parent.$router.addRoutes([{
          name: route.name,
          path: route.path,
          children: subroutes
        }])
      }
    }
    this.$nextTick(() => {
      this.boot()
    })
    return h('div', { ref: 'host', attrs: { 'mfe-router-outlet': true }})
  },

  methods: {
    boot () {
      const route = this.$parent.$route
      const depth = 0
      const matched = route.matched[depth]
      if (matched && matched.mfes) {
        const name = Object.keys(matched.mfes)[0]
        const mfe = matched && matched.mfes[name]
        if (!mfe.mfevm) {
          if (this.useShadowDom) {
            const host = this.$refs.host
            const shadowroot = host.attachShadow({ mode: 'open' })

            const shodowhost = document.createElement('div')

            shadowroot.appendChild(shodowhost)
            mfe.boot(shodowhost, { mountpoint: shadowroot, router: this.$parent.$router, depth: depth + 1 }).then(() => {
              this.$emit('bootfinished')
            })
          } else {
            const host = this.$refs.host
            mfe.boot(host, { mountpoint: this.$refs.host, router: this.$parent.$router, depth: depth + 1 }).then(() => {
              this.$emit('bootfinished')
            })
          }
        }
      }
    }
  },

  mounted () {
    this.boot()
  }
}
