import { warn } from '../util/warn'

const MFEBooter = {
  name: 'mfe-booter',
  props: {
    mfe: {},
    depth: {}
  },
  render (h) {
    console.log('Booting mfe: ', this.mfe)

    this.$nextTick(() => {
      this.mountmfe()
    })

    // if (this.mfe && this.mfe.mfevm) {
    //   const el = this.mfe.mfevm.$el
    //   const temphost = document.querySelector('#temphost')
    //   temphost.innerHTML = ''
    //   temphost.appendChild(el)
    // }

    return h('div', { attrs: { 'mfe-name': this.mfe && this.mfe.name }})
  },
  watch: {
    mfe: function (newvalue, oldvalue) {
      warn('Running watcher')
      if (oldvalue && oldvalue.name && oldvalue.name !== newvalue.name) {
        try {
          oldvalue.mfevm.$destroy()
          oldvalue.mfevm = null
        } catch (err) {
          warn('Tried to destroy vm but got error')
        }
      }
    }
  },
  methods: {
    mountmfe () {
      if (this.mfe && !this.mfe.mfevm) { //  TODO: Modify to check that this vm is mounted on host
        let shadowroot = this.$el.shadowRoot
        if (!shadowroot) {
          shadowroot = this.$el.attachShadow({ mode: 'open' })
        }
        shadowroot.innerHTML = ''
        const shodowhost = document.createElement('div')
        shadowroot.appendChild(shodowhost)

        this.mfe.boot(shodowhost, { mountpoint: shadowroot, router: this.$router, depth: this.depth }).then(() => {
          this.$emit('bootfinished')
        })
      }
    }
  }
}

export default {
  name: 'router-mfe',
  functional: true,
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
  render (h, { props, children, parent, data }) {
    // used by devtools to display a router-view badge
    // data.routerView = true
    // const h = parent.$createElement
    data.routerView = true
    const route = parent.$route
    const depth = 0
    const matched = route.matched[depth]

    let vnode = h('div', { attrs: { 'mfe-router-outlet': true }}, 'No mfe was matched!')

    if (matched && matched.mfes) {
      const name = Object.keys(matched.mfes)[0]
      const mfe = matched && matched.mfes[name]

      if (name && mfe) {
        const subroutes = mfe.routes
        parent.$router.addRoutes([{
          name: route.name,
          path: route.path,
          mfe: mfe,
          children: subroutes
        }])
      }

      vnode = h('div',
        {
          attrs: { 'mfe-router-outlet': true }
        },
        [
          h(MFEBooter, { props: { mfe, depth: depth + 1 }})
        ])
    }
    return vnode
  }
}
